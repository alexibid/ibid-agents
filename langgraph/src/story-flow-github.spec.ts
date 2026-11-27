import { MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';
import type { IssueStage } from './backlog/issue-stage.js';
import type { GithubSync, IssueSync } from './backlog/issue-sync.js';
import type { ChangeTracker } from './checks/workspace-changes.js';
import { NO_OTHER_STORIES } from './domain/concurrent-stories.js';
import type { MandatoryStep, ProjectSheet } from './domain/sheet.js';
import { buildFlowGraph } from './flow/graph.js';
import { StoryFlow, StoryNotCommittedError } from './story-flow.js';

const COVER = 'apps/demo/src/cover.ts';
const story = { project: 'demo', title: 'Open the cover', criteria: ['The cover opens'] };
const origin = { issue: 'https://github.com/demo/site/issues/38', epic: 'https://github.com/demo/site/issues/36' };
const UPDATED: GithubSync = { state: 'updated', on: '2026-11-23T10:40:00.000Z', detail: 'updated' };

class RecordingSync implements IssueSync {
  readonly stages: IssueStage[] = [];
  built = 0;
  closed = 0;

  async show(_origin: unknown, stage: IssueStage): Promise<GithubSync> {
    this.stages.push(stage);
    return UPDATED;
  }

  async closeBuilt(_origin: unknown, stage: 'ready-for-commit' | 'awaiting-commit'): Promise<GithubSync> {
    this.stages.push(stage);
    this.built += 1;
    return UPDATED;
  }

  async closeDone(): Promise<GithubSync> {
    this.closed += 1;
    return UPDATED;
  }
}

const coverChanged: ChangeTracker = {
  fingerprint: async () => ({}),
  changedSince: async () => [{ repository: '.', file: COVER, alreadyDirty: false }],
};

function flowWith(sync: IssueSync, mandatorySteps: readonly MandatoryStep[]): StoryFlow {
  const sheet: ProjectSheet = {
    project: 'demo',
    path: 'apps/demo',
    commitScope: 'demo',
    sheetFile: 'demo.md',
    reuses: [],
    specialist: 'agents/specialist.md',
    agents: [],
    triggers: [],
    mandatorySteps,
    commands: {},
  };
  const graph = buildFlowGraph(
    { workspaceRoot: '/workspace', sheets: { read: async () => sheet }, contractsDirectory: '/contracts', changesOf: () => coverChanged, activeStories: NO_OTHER_STORIES },
    new MemorySaver(),
  );
  return new StoryFlow(graph, undefined, sync);
}

const always = (...steps: MandatoryStep['step'][]): MandatoryStep[] => steps.map((step) => ({ step, when: 'always' }));

describe('StoryFlow keeping GitHub up to date', () => {
  it('should update the issue each time the story moves to another stage, and only then', async () => {
    const sync = new RecordingSync();
    const flow = flowWith(sync, always('implement', 'review'));
    const { storyId } = await flow.startStory(story, origin);
    await flow.submit(storyId, { files: [COVER], conditions: [] });

    const built = await flow.submit(storyId, { summary: 'opened the cover' });

    expect(sync.stages).toEqual(['building', 'ready-for-commit']);
    expect(sync.built).toBe(1);
    expect(built.github).toEqual(UPDATED);
  });

  it('should refuse to close the issue while a file of the story is still uncommitted', async () => {
    const sync = new RecordingSync();
    const flow = flowWith(sync, always('implement'));
    const { storyId } = await flow.startStory(story, origin);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    await flow.submit(storyId, { summary: 'opened the cover' });

    await expect(flow.confirmCommit(storyId, [COVER])).rejects.toThrow(StoryNotCommittedError);
    expect(sync.closed).toBe(0);
  });

  it('should close the issue once every file of the finished story is committed', async () => {
    const sync = new RecordingSync();
    const flow = flowWith(sync, always('implement'));
    const { storyId } = await flow.startStory(story, origin);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    await flow.submit(storyId, { summary: 'opened the cover' });

    await flow.confirmCommit(storyId, []);

    expect(sync.closed).toBe(1);
  });

  it('should close a committed story found while reviewing every issue', async () => {
    const sync = new RecordingSync();
    const flow = flowWith(sync, always('implement'));
    const { storyId } = await flow.startStory(story, origin);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    await flow.submit(storyId, { summary: 'opened the cover' });

    await flow.resync(storyId, []);

    expect(sync.closed).toBe(1);
  });
});
