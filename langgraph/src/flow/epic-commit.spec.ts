import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemorySaver } from '@langchain/langgraph';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IssueStage } from '../backlog/issue-stage.js';
import type { GithubSync, IssueSync } from '../backlog/issue-sync.js';
import type { ChangeTracker, ChangedFile, Fingerprint } from '../checks/workspace-changes.js';
import { NO_OTHER_STORIES } from '../domain/concurrent-stories.js';
import type { ProjectSheet } from '../domain/sheet.js';
import { StoryFlow, StoryNotCommittedError } from '../story-flow.js';
import { EpicNotReadyError } from './epic-commit.js';
import { buildFlowGraph } from './graph.js';
import { CHECK_UNCHANGED, ONLY_TESTS_CHANGED, VALIDATION_KEPT } from './repeat-skips.js';

const EPIC = 'https://github.com/demo/site/issues/78';
const ISSUE_1 = 'https://github.com/demo/site/issues/80';
const ISSUE_2 = 'https://github.com/demo/site/issues/83';
const ISSUE_3 = 'https://github.com/demo/site/issues/86';
const TS_1 = 'apps/demo/src/form.ts';
const SPEC_1 = 'apps/demo/src/form.spec.ts';
const TS_2 = 'apps/demo/src/banner.ts';
const SPEC_2 = 'apps/demo/src/banner.spec.ts';
const E2E_SPEC = 'apps/demo/e2e/contact-layout.spec.ts';
const QUICK_SCSS = 'apps/demo/src/_base.scss';
const UPDATED: GithubSync = { state: 'updated', on: '2026-11-26T00:00:00.000Z', detail: 'updated' };

class VersionedTree implements ChangeTracker {
  private readonly versions = new Map<string, number>();

  edit(...files: string[]): void {
    for (const file of files) {
      this.versions.set(file, (this.versions.get(file) ?? 0) + 1);
    }
  }

  async fingerprint(): Promise<Fingerprint> {
    return Object.fromEntries([...this.versions.entries()].map(([file, count]) => [file, String(count)]));
  }

  async changedSince(since: Fingerprint): Promise<ChangedFile[]> {
    return [...this.versions.entries()]
      .filter(([file, count]) => String(count) !== since[file])
      .map(([file]) => ({ repository: '.', file, alreadyDirty: file in since }));
  }
}

class RecordingSync implements IssueSync {
  readonly built: string[] = [];
  readonly closed: string[] = [];

  async show(_origin: unknown, _stage: IssueStage): Promise<GithubSync> {
    return UPDATED;
  }

  async closeBuilt(origin: { readonly issue: string }): Promise<GithubSync> {
    this.built.push(origin.issue);
    return UPDATED;
  }

  async closeDone(origin: { readonly issue: string }): Promise<GithubSync> {
    this.closed.push(origin.issue);
    return UPDATED;
  }
}

const sheet: ProjectSheet = {
  project: 'demo',
  path: 'apps/demo',
  commitScope: 'demo',
  sheetFile: 'demo.md',
  reuses: [],
  specialist: 'agents/specialist.md',
  agents: [],
  triggers: [],
  mandatorySteps: [
    { step: 'implement', when: 'always' },
    { step: 'author-tests', when: 'always' },
    { step: 'build', when: 'always' },
    { step: 'lint', when: 'always' },
    { step: 'unit-tests', when: 'always' },
    { step: 'validate-tests', when: 'always' },
    { step: 'browser-qa', when: 'ui' },
    { step: 'ux-critique', when: 'ui' },
    { step: 'review', when: 'always' },
  ],
  commands: { build: 'true', lint: 'true', 'unit-tests': 'true' },
};

describe('StoryFlow epic commit', () => {
  let root = '';
  let tree: VersionedTree;
  let sync: RecordingSync;
  let flow: StoryFlow;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'epic-commit-'));
    await writeFile(join(root, 'qa.png'), '');
    tree = new VersionedTree();
    sync = new RecordingSync();
    const changesOf = () => tree;
    const graph = buildFlowGraph(
      { workspaceRoot: root, sheets: { read: async () => sheet }, contractsDirectory: '/contracts', changesOf, activeStories: NO_OTHER_STORIES },
      new MemorySaver(),
    );
    flow = new StoryFlow(graph, undefined, sync).withChanges({ changesOf, activeStories: NO_OTHER_STORIES });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function buildReadyStory(issue: string, title: string, criterion: string, files: readonly [string, string]): Promise<string> {
    const { storyId } = await flow.startStory({ project: 'demo', title, criteria: [criterion] }, { issue, epic: EPIC });
    await flow.submit(storyId, { files: [files[0]], conditions: [] });
    tree.edit(files[0]);
    await flow.submit(storyId, { summary: title });
    tree.edit(files[1]);
    await flow.submit(storyId, { specFiles: [files[1]] });
    return storyId;
  }

  it('should run validate-tests and review once for all ready-for-commit stories while skipping unfinished building stories', async () => {
    const s1 = await buildReadyStory(ISSUE_1, 'Form fields', 'Fields validate input', [TS_1, SPEC_1]);
    const s2 = await buildReadyStory(ISSUE_2, 'Feedback banner', 'Banner announces submission', [TS_2, SPEC_2]);
    const { storyId: s3 } = await flow.startStory(
      { project: 'demo', title: 'Draft story', criteria: ['Draft still building'] },
      { issue: ISSUE_3, epic: EPIC },
    );
    await flow.submit(s3, { files: ['apps/demo/src/draft.ts'], conditions: [] });

    const epicRun = await flow.advanceEpicToCommit(EPIC, [s1, s2, s3]);

    expect(epicRun.epicMembers).toEqual([s1, s2]);
    expect(epicRun.next === 'nothing' ? '' : epicRun.next.step).toBe('validate-tests');
    expect(epicRun.next === 'nothing' ? [] : epicRun.next.story.criteria).toEqual(['Fields validate input', 'Banner announces submission']);
    expect(epicRun.files).toEqual([TS_1, TS_2, SPEC_1, SPEC_2]);

    await flow.submit(epicRun.storyId, {
      criteria: [
        { criterion: 'Fields validate input', test: 'validates', proven: true },
        { criterion: 'Banner announces submission', test: 'announces', proven: true },
      ],
    });
    const finished = await flow.submit(epicRun.storyId, { findings: [] });

    expect(finished.status).toBe('finished');
    expect((await flow.report(s1)).status).toBe('finished');
    expect((await flow.report(s2)).status).toBe('finished');
    expect((await flow.report(s3)).status).toBe('working');

    await expect(flow.confirmEpicCommit(EPIC, [s1, s2, epicRun.storyId], async () => [TS_1])).rejects.toThrow(StoryNotCommittedError);
    await flow.confirmEpicCommit(EPIC, [s1, s2, epicRun.storyId], async () => []);
    expect(sync.closed).toEqual([ISSUE_1, ISSUE_2]);
  });

  it('should observe a pending quick-change ui edit on epic commit and pull browser-qa and ux-critique into the run', async () => {
    const s1 = await buildReadyStory(ISSUE_1, 'Form fields', 'Fields validate input', [TS_1, SPEC_1]);
    const s2 = await buildReadyStory(ISSUE_2, 'Feedback banner', 'Banner announces submission', [TS_2, SPEC_2]);
    tree.edit(QUICK_SCSS);

    const epicRun = await flow.advanceEpicToCommit(EPIC, [s1, s2]);
    await flow.submit(epicRun.storyId, {
      criteria: [
        { criterion: 'Fields validate input', test: 'validates', proven: true },
        { criterion: 'Banner announces submission', test: 'announces', proven: true },
      ],
    });

    const atQa = await flow.report(epicRun.storyId);
    expect(atQa.next === 'nothing' ? '' : atQa.next.step).toBe('browser-qa');
    await flow.submit(epicRun.storyId, { verdict: 'pass', findings: [], screenshots: ['qa.png'] });

    const atUx = await flow.report(epicRun.storyId);
    expect(atUx.next === 'nothing' ? '' : atUx.next.step).toBe('ux-critique');
    await flow.submit(epicRun.storyId, { findings: [], screenshots: ['qa.png'] });

    const finished = await flow.submit(epicRun.storyId, { findings: [] });
    expect(finished.status).toBe('finished');
  });

  it('should fold an already-advancing commit story into the epic run and refuse when no stories are ready', async () => {
    const { storyId: s1 } = await flow.startStory(
      { project: 'demo', title: 'Draft', criteria: ['Draft criterion'] },
      { issue: ISSUE_1, epic: EPIC },
    );
    await expect(flow.advanceEpicToCommit(EPIC, [s1])).rejects.toThrow(EpicNotReadyError);

    await flow.submit(s1, { files: [TS_1], conditions: [] });
    tree.edit(TS_1);
    await flow.submit(s1, { summary: 'done' });
    tree.edit(SPEC_1);
    await flow.submit(s1, { specFiles: [SPEC_1] });
    await flow.advanceToCommit(s1);
    const s2 = await buildReadyStory(ISSUE_2, 'Second', 'Second criterion', [TS_2, SPEC_2]);

    const epicRun = await flow.advanceEpicToCommit(EPIC, [s1, s2]);
    expect(epicRun.epicMembers).toEqual([s1, s2]);
    expect((await flow.report(s1)).status).toBe('ready-for-commit');
  });

  it('should keep an epic commit run in commit phase across 4 browser-qa repair loops and skip unchanged unit-tests and validate-tests on e2e fixes', async () => {
    const s1 = await buildReadyStory(ISSUE_1, 'Form fields', 'Fields validate input', [TS_1, SPEC_1]);
    const s2 = await buildReadyStory(ISSUE_2, 'Feedback banner', 'Banner announces submission', [TS_2, SPEC_2]);
    tree.edit(QUICK_SCSS);
    const epicRun = await flow.advanceEpicToCommit(EPIC, [s1, s2]);
    await flow.submit(epicRun.storyId, {
      criteria: [
        { criterion: 'Fields validate input', test: 'validates', proven: true },
        { criterion: 'Banner announces submission', test: 'announces', proven: true },
      ],
    });

    const qaFail1 = await flow.submit(epicRun.storyId, { verdict: 'fail', findings: ['scrollLeft spillover'], screenshots: ['qa.png'] });
    expect(qaFail1.phase).toBe('commit');
    expect(qaFail1.status).toBe('working');
    expect(qaFail1.next === 'nothing' ? '' : qaFail1.next.step).toBe('implement');

    tree.edit(QUICK_SCSS);
    const afterCssFix = await flow.submit(epicRun.storyId, {
      summary: 'fixed spillover scss',
      extraFiles: [{ file: QUICK_SCSS, reason: 'fix overflow' }],
    });
    expect(afterCssFix.phase).toBe('commit');
    expect(afterCssFix.next === 'nothing' ? '' : afterCssFix.next.step).toBe('browser-qa');
    expect(afterCssFix.history.at(-1)).toEqual({ step: 'validate-tests', passed: true, details: [VALIDATION_KEPT] });

    for (const attempt of [2, 3, 4]) {
      const qaFail = await flow.submit(epicRun.storyId, { verdict: 'fail', findings: [`e2e bug ${attempt}`], screenshots: ['qa.png'] });
      expect(qaFail.status).toBe('working');
      expect(qaFail.phase).toBe('commit');
      expect(qaFail.attempts['browser-qa']).toBe(attempt);
      expect(qaFail.next === 'nothing' ? '' : qaFail.next.step).toBe('implement');

      tree.edit(E2E_SPEC);
      const afterE2eFix = await flow.submit(epicRun.storyId, { summary: `fixed e2e ${attempt}` });
      expect(afterE2eFix.status).toBe('working');
      expect(afterE2eFix.phase).toBe('commit');
      expect(afterE2eFix.next === 'nothing' ? '' : afterE2eFix.next.step).toBe('browser-qa');
      expect(afterE2eFix.history.slice(-4).map(({ step, details }) => [step, details])).toEqual([
        ['build', [ONLY_TESTS_CHANGED]],
        ['lint', []],
        ['unit-tests', [CHECK_UNCHANGED]],
        ['validate-tests', [VALIDATION_KEPT]],
      ]);
    }

    await flow.submit(epicRun.storyId, { verdict: 'pass', findings: [], screenshots: ['qa.png'] });
    await flow.submit(epicRun.storyId, { findings: [], screenshots: ['qa.png'] });
    const finished = await flow.submit(epicRun.storyId, { findings: [] });
    expect(finished.status).toBe('finished');
    expect((await flow.report(s1)).status).toBe('finished');
    expect((await flow.report(s2)).status).toBe('finished');
  });
});
