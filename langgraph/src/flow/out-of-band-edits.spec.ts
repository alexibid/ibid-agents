import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemorySaver } from '@langchain/langgraph';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ChangeTracker, ChangedFile, Fingerprint } from '../checks/workspace-changes.js';
import { type ActiveStories } from '../domain/concurrent-stories.js';
import type { ProjectSheet } from '../domain/sheet.js';
import { StoryFlow } from '../story-flow.js';
import { buildFlowGraph } from './graph.js';
import { REVIEW_KEPT, VALIDATION_KEPT } from './repeat-skips.js';

const COVER_TS = 'apps/demo/src/cover.ts';
const COVER_SCSS = 'apps/demo/src/cover.scss';
const COVER_SPEC = 'apps/demo/src/cover.spec.ts';
const MANUAL_LAYOUT = 'apps/demo/src/layout.scss';
const QUICK_BASE = 'apps/demo/src/_base.scss';
const OTHER_APP = 'apps/other/src/other.scss';

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
    { step: 'review', when: 'always' },
  ],
  commands: { build: 'true', lint: 'true', 'unit-tests': 'true' },
};

const story = { project: 'demo', title: 'Cover styling', criteria: ['Cover looks balanced'] };

describe('StoryFlow with out-of-band manual and quick-change edits', () => {
  let root = '';
  let tree: VersionedTree;
  let alongside: { storyId: string; files: readonly string[] }[];
  let flow: StoryFlow;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'out-of-band-'));
    await writeFile(join(root, 'qa.png'), '');
    tree = new VersionedTree();
    alongside = [];
    const activeStories: ActiveStories = {
      besides: async () => [],
      changedAlongside: async () => alongside,
    };
    const changesOf = () => tree;
    const graph = buildFlowGraph(
      { workspaceRoot: root, sheets: { read: async () => sheet }, contractsDirectory: '/contracts', changesOf, activeStories },
      new MemorySaver(),
    );
    flow = new StoryFlow(graph).withChanges({ changesOf, activeStories });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function reachValidateTests(): Promise<string> {
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER_TS, COVER_SCSS], conditions: ['ui'] });
    tree.edit(COVER_TS, COVER_SCSS);
    await flow.submit(storyId, { summary: 'styled cover' });
    tree.edit(COVER_SPEC);
    await flow.submit(storyId, { specFiles: [COVER_SPEC] });
    await flow.advanceToCommit(storyId);
    return storyId;
  }

  it('should not block repair implement on manual out-of-band edits made while waiting or in QA, nor absorb them into plan files', async () => {
    const storyId = await reachValidateTests();
    await flow.submit(storyId, { criteria: [{ criterion: 'Cover looks balanced', test: 'balanced', proven: true }] });
    tree.edit(MANUAL_LAYOUT, OTHER_APP);
    const qaFailed = await flow.submit(storyId, { verdict: 'fail', findings: ['Spacing off'], screenshots: ['qa.png'] });
    expect(qaFailed.next === 'nothing' ? '' : qaFailed.next.step).toBe('implement');

    tree.edit(COVER_SCSS);
    const repaired = await flow.submit(storyId, { summary: 'adjusted spacing' });

    expect(repaired.phase).toBe('commit');
    expect(repaired.next === 'nothing' ? '' : repaired.next.step).toBe('browser-qa');
    expect(repaired.history.findLast(({ step }) => step === 'implement')).toEqual({ step: 'implement', passed: true, details: [] });
    expect(repaired.files).toEqual([COVER_TS, COVER_SCSS, COVER_SPEC]);
  });

  it('should rewind and re-run build and browser-qa when a quick-change edits scss during review while skipping validate-tests and review', async () => {
    const storyId = await reachValidateTests();
    await flow.submit(storyId, { criteria: [{ criterion: 'Cover looks balanced', test: 'balanced', proven: true }] });
    await flow.submit(storyId, { verdict: 'pass', findings: [], screenshots: ['qa.png'] });

    alongside.push({ storyId: 'quick-change~css', files: [QUICK_BASE] });
    tree.edit(QUICK_BASE);

    const afterReview = await flow.submit(storyId, { findings: [] });

    expect(afterReview.status).toBe('working');
    expect(afterReview.next === 'nothing' ? '' : afterReview.next.step).toBe('browser-qa');
    const recentHistory = afterReview.history.slice(-5);
    expect(recentHistory.map(({ step }) => step)).toEqual(['review', 'build', 'lint', 'unit-tests', 'validate-tests']);
    expect(recentHistory.find(({ step }) => step === 'validate-tests')?.details).toEqual([VALIDATION_KEPT]);

    const afterQa = await flow.submit(storyId, { verdict: 'pass', findings: [], screenshots: ['qa.png'] });

    expect(afterQa.status).toBe('finished');
    expect(afterQa.history.at(-1)).toEqual({ step: 'review', passed: true, details: [REVIEW_KEPT] });
  });

  it('should re-check only affected steps when advanceToCommit is called after holdForCommit or finished with pending edits', async () => {
    const storyId = await reachValidateTests();
    await flow.submit(storyId, { criteria: [{ criterion: 'Cover looks balanced', test: 'balanced', proven: true }] });

    await flow.holdForCommit(storyId);
    tree.edit(COVER_SPEC);
    const resumedForSpec = await flow.advanceToCommit(storyId);

    expect(resumedForSpec.next === 'nothing' ? '' : resumedForSpec.next.step).toBe('validate-tests');
    expect(resumedForSpec.history.slice(-2).map(({ step }) => step)).toEqual(['lint', 'unit-tests']);

    await flow.submit(storyId, { criteria: [{ criterion: 'Cover looks balanced', test: 'balanced', proven: true }] });
    await flow.submit(storyId, { verdict: 'pass', findings: [], screenshots: ['qa.png'] });
    const finished = await flow.submit(storyId, { findings: [] });
    expect(finished.status).toBe('finished');

    tree.edit(OTHER_APP);
    expect((await flow.advanceToCommit(storyId)).status).toBe('finished');

    tree.edit(MANUAL_LAYOUT);
    const rechecked = await flow.advanceToCommit(storyId);
    expect(rechecked.status).toBe('working');
    expect(rechecked.next === 'nothing' ? '' : rechecked.next.step).toBe('browser-qa');
  });
});
