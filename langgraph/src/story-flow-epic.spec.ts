import { mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GithubSync, IssueSync } from './backlog/issue-sync.js';
import type { ChangeTracker, ChangedFile, Fingerprint } from './checks/workspace-changes.js';
import type { MandatoryStep, ProjectSheet } from './domain/sheet.js';
import { CheckpointActiveStories } from './flow/checkpoint-active-stories.js';
import { buildFlowGraph } from './flow/graph.js';
import { StoryFlow, StoryNotCommittedError } from './story-flow.js';

const SHARED_SCSS = 'apps/demo/src/exit/exit.scss';
const SHARED_TS = 'apps/demo/src/exit/exit.ts';
const SHARED_SPEC = 'apps/demo/src/exit/exit.spec.ts';
const S1_ONLY = 'apps/demo/src/exit/nav.ts';
const S2_ONLY = 'apps/demo/src/exit/heading.ts';

const EPIC_A = 'https://github.com/demo/site/issues/78';
const EPIC_B = 'https://github.com/demo/site/issues/99';
const ISSUE_1 = 'https://github.com/demo/site/issues/80';
const ISSUE_2 = 'https://github.com/demo/site/issues/83';
const ISSUE_3 = 'https://github.com/demo/site/issues/84';
const UPDATED: GithubSync = { state: 'updated', on: '2026-11-26T00:00:00.000Z', detail: 'updated' };

class VersionedTree implements ChangeTracker {
  private readonly versions = new Map<string, number>();

  edit(...files: string[]): void {
    for (const file of files) {
      this.versions.set(file, (this.versions.get(file) ?? 0) + 1);
    }
  }

  async fingerprint(): Promise<Fingerprint> {
    return Object.fromEntries([...this.versions.entries()].map(([file, version]) => [file, String(version)]));
  }

  async changedSince(since: Fingerprint): Promise<ChangedFile[]> {
    return [...this.versions.entries()]
      .filter(([file, version]) => String(version) !== since[file])
      .map(([file]) => ({ repository: '.', file, alreadyDirty: file in since }));
  }
}

class RecordingSync implements IssueSync {
  readonly closed: string[] = [];

  async show(): Promise<GithubSync> {
    return UPDATED;
  }

  async closeBuilt(): Promise<GithubSync> {
    return UPDATED;
  }

  async closeDone(origin: { readonly issue: string }): Promise<GithubSync> {
    this.closed.push(origin.issue);
    return UPDATED;
  }
}

const steps: MandatoryStep[] = [
  { step: 'implement', when: 'always' },
  { step: 'author-tests', when: 'always' },
  { step: 'review', when: 'always' },
];

const sheet: ProjectSheet = {
  project: 'demo',
  path: 'apps/demo',
  commitScope: 'demo',
  sheetFile: 'demo.md',
  reuses: [],
  specialist: 'agents/specialist.md',
  agents: [],
  triggers: [],
  mandatorySteps: steps,
  commands: {},
};

const story = (title: string) => ({ project: 'demo', title, criteria: [`${title} works`] });

describe('StoryFlow with sequential stories in the same epic', () => {
  let folder = '';
  let runsFile = '';
  let saver: SqliteSaver | undefined;
  let tree: VersionedTree;
  let sync: RecordingSync;
  let flow: StoryFlow;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'story-flow-epic-'));
    const stateFile = join(folder, 'stories.sqlite');
    runsFile = join(folder, 'agent-runs.sqlite');
    saver = SqliteSaver.fromConnString(stateFile);
    tree = new VersionedTree();
    sync = new RecordingSync();
    const graph = buildFlowGraph(
      {
        workspaceRoot: '/workspace',
        sheets: { read: async () => sheet },
        contractsDirectory: '/contracts',
        changesOf: () => tree,
        activeStories: new CheckpointActiveStories(stateFile, { agentRunsFile: runsFile, workspaceRoot: '/workspace' }),
      },
      saver,
    );
    flow = new StoryFlow(graph, undefined, sync);
  });

  afterEach(async () => {
    saver?.db.close();
    await rm(folder, { recursive: true, force: true });
  });

  it('should let a second story in the same epic share files and specs after ready-for-commit, then advance and confirm both', async () => {
    const { storyId: s1 } = await flow.startStory(story('First exit story'), { issue: ISSUE_1, epic: EPIC_A });
    await flow.submit(s1, { files: [SHARED_SCSS, SHARED_TS, S1_ONLY], conditions: [] });
    tree.edit(SHARED_SCSS, SHARED_TS, S1_ONLY);
    await flow.submit(s1, { summary: 'first implementation' });
    tree.edit(SHARED_SPEC);
    const s1Ready = await flow.submit(s1, { specFiles: [SHARED_SPEC] });
    expect(s1Ready.status).toBe('ready-for-commit');

    const { storyId: s2 } = await flow.startStory(story('Second exit story'), { issue: ISSUE_2, epic: EPIC_A });
    const s2Planned = await flow.submit(s2, { files: [SHARED_SCSS, SHARED_TS, S2_ONLY], conditions: [] });
    expect(s2Planned.status).toBe('working');

    tree.edit(SHARED_SCSS, SHARED_TS, S2_ONLY);
    await flow.submit(s2, { summary: 'second implementation' });
    tree.edit(SHARED_SPEC);
    const s2Ready = await flow.submit(s2, { specFiles: [SHARED_SPEC] });
    expect(s2Ready.status).toBe('ready-for-commit');
    expect(s2Ready.files).toContain(SHARED_SPEC);

    await flow.advanceToCommit(s1);
    const s1Finished = await flow.submit(s1, { findings: [] });
    await flow.advanceToCommit(s2);
    const s2Finished = await flow.submit(s2, { findings: [] });

    expect(s1Finished.status).toBe('finished');
    expect(s2Finished.status).toBe('finished');

    await expect(flow.confirmCommit(s1, [SHARED_SCSS])).rejects.toThrow(StoryNotCommittedError);
    await flow.confirmCommit(s1, []);
    await flow.confirmCommit(s2, []);
    expect(sync.closed).toEqual([ISSUE_1, ISSUE_2]);
  });

  it('should let a second story started early share files and extend the shared spec after the first reaches ready-for-commit', async () => {
    const { storyId: s1 } = await flow.startStory(story('First exit story'), { issue: ISSUE_1, epic: EPIC_A });
    const { storyId: s2 } = await flow.startStory(story('Second exit story'), { issue: ISSUE_2, epic: EPIC_A });

    await flow.submit(s1, { files: [SHARED_SCSS, S1_ONLY], conditions: [] });
    tree.edit(SHARED_SCSS, S1_ONLY);
    await flow.submit(s1, { summary: 'first implementation' });
    tree.edit(SHARED_SPEC);
    const s1Ready = await flow.submit(s1, { specFiles: [SHARED_SPEC] });
    expect(s1Ready.status).toBe('ready-for-commit');

    const s2Planned = await flow.submit(s2, { files: [SHARED_SCSS, S2_ONLY], conditions: [] });
    expect(s2Planned.status).toBe('working');

    tree.edit(SHARED_SCSS, S2_ONLY);
    await flow.submit(s2, { summary: 'second implementation' });
    tree.edit(SHARED_SPEC);
    const s2Ready = await flow.submit(s2, { specFiles: [SHARED_SPEC] });

    expect(s2Ready.status).toBe('ready-for-commit');
    expect(s2Ready.files).toContain(SHARED_SPEC);
  });

  it('should accept overlapping files even when another story is ready-for-commit in another epic or without an epic', async () => {
    const { storyId: s1 } = await flow.startStory(story('First exit story'), { issue: ISSUE_1, epic: EPIC_A });
    await flow.submit(s1, { files: [SHARED_SCSS], conditions: [] });
    tree.edit(SHARED_SCSS);
    await flow.submit(s1, { summary: 'first implementation' });
    tree.edit(SHARED_SPEC);
    await flow.submit(s1, { specFiles: [SHARED_SPEC] });

    const { storyId: otherEpic } = await flow.startStory(story('Other epic story'), { issue: ISSUE_2, epic: EPIC_B });
    const acceptedOther = await flow.submit(otherEpic, { files: [SHARED_SCSS], conditions: [] });
    expect(acceptedOther.status).toBe('working');

    const { storyId: noEpic } = await flow.startStory(story('Loose story'), { issue: ISSUE_3, epic: '' });
    const acceptedLoose = await flow.submit(noEpic, { files: [SHARED_SCSS], conditions: [] });
    expect(acceptedLoose.status).toBe('working');
  });

  it('should accept overlapping files while another story is working or needs-user and track each story own changes', async () => {
    const { storyId: s1 } = await flow.startStory(story('First exit story'), { issue: ISSUE_1, epic: EPIC_A });
    await flow.submit(s1, { files: [SHARED_SCSS, S1_ONLY], conditions: [] });

    const { storyId: s2 } = await flow.startStory(story('Second exit story'), { issue: ISSUE_2, epic: EPIC_B });
    const whileWorking = await flow.submit(s2, { files: [SHARED_SCSS, S2_ONLY], conditions: [] });
    expect(whileWorking.status).toBe('working');

    tree.edit(SHARED_SCSS, S1_ONLY, S2_ONLY);
    await flow.submit(s1, { summary: 'first implementation' });
    await flow.submit(s2, { summary: 'second implementation' });
    tree.edit(SHARED_SPEC);
    const s1Ready = await flow.submit(s1, { specFiles: [SHARED_SPEC] });
    const s2Ready = await flow.submit(s2, { specFiles: [SHARED_SPEC] });

    expect(s1Ready.status).toBe('ready-for-commit');
    expect(s2Ready.status).toBe('ready-for-commit');
    expect(s2Ready.files).toContain(SHARED_SPEC);

    const { storyId: s3 } = await flow.startStory(story('Paused story'), { issue: ISSUE_3, epic: EPIC_A });
    await flow.submit(s3, { files: [SHARED_SCSS], conditions: [] });
    await flow.submit(s3, { summary: 'blocked', questions: ['Keep shadow?'] });

    const { storyId: s4 } = await flow.startStory(story('Fourth story'), { issue: ISSUE_2, epic: EPIC_B });
    const whileNeedsUser = await flow.submit(s4, { files: [SHARED_SCSS], conditions: [] });
    expect(whileNeedsUser.status).toBe('working');
  });

  it('should accept overlapping files regardless of epic status when linking origin or resuming', async () => {
    const { storyId: s1 } = await flow.startStory(story('First exit story'), { issue: ISSUE_1, epic: EPIC_A });
    await flow.submit(s1, { files: [SHARED_SCSS], conditions: [] });
    tree.edit(SHARED_SCSS);
    await flow.submit(s1, { summary: 'first implementation' });
    tree.edit(SHARED_SPEC);
    await flow.submit(s1, { specFiles: [SHARED_SPEC] });

    const { storyId: s2 } = await flow.startStory(story('Second exit story'), { issue: ISSUE_2, epic: '' });
    await flow.linkOrigin(s2, { issue: ISSUE_2, epic: EPIC_A });
    const asked = await flow.submit(s2, { questions: ['Keep exit heading centered?'] });
    expect(asked.status).toBe('needs-user');

    await flow.resume(s2, 'Yes, keep it centered.');
    const acceptedAfterResume = await flow.submit(s2, { files: [SHARED_SCSS], conditions: [] });
    expect(acceptedAfterResume.status).toBe('working');
  });

  it('should not blame a story implementation for files changed by a concurrent quick-change run', async () => {
    const { storyId } = await flow.startStory(story('Exit spacing'), { issue: ISSUE_1, epic: EPIC_A });
    await flow.submit(storyId, { files: [SHARED_SCSS], conditions: [] });

    const runs = new DatabaseSync(runsFile);
    runs.exec(`create table checkpoints (thread_id text, checkpoint_ns text default '', checkpoint_id text, checkpoint blob)`);
    runs
      .prepare('insert into checkpoints (thread_id, checkpoint_id, checkpoint) values (?, ?, ?)')
      .run(
        'quick-change~book',
        '1',
        JSON.stringify({
          ts: new Date(Date.now() + 60_000).toISOString(),
          channel_values: { status: 'finished', results: { change: { changedFiles: [`/workspace/${S2_ONLY}`] } } },
        }),
      );
    runs.close();

    tree.edit(SHARED_SCSS, S2_ONLY);
    const implemented = await flow.submit(storyId, { summary: 'styled exit' });

    expect(implemented.history.at(-1)).toEqual({ step: 'implement', passed: true, details: [] });
    expect(implemented.files).toEqual([SHARED_SCSS]);
  });
});
