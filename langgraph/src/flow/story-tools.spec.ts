import { MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';
import type { ChangeTracker } from '../checks/workspace-changes.js';
import { NO_OTHER_STORIES } from '../domain/concurrent-stories.js';
import type { ProjectSheet } from '../domain/sheet.js';
import { StoryFlow, type StoryReport } from '../story-flow.js';
import { buildFlowGraph } from './graph.js';
import { advanceSingleStory, confirmStoryOrEpic } from './story-commit-tools.js';
import { ensureNoPendingDecision, PendingDecisionReviewError, storiesToSync, syncedStories, type StoryWorkspace } from './story-tools.js';
import type { DecisionRunRecord } from '../agent-runs/decision-issues.js';

const ISSUE = 'https://github.com/demo/site/issues/42';
const ISSUE_2 = 'https://github.com/demo/site/issues/43';
const EPIC = 'https://github.com/demo/site/issues/40';
const FILE_1 = 'apps/demo/src/a.ts';
const FILE_2 = 'apps/demo/src/b.ts';

const report = (storyId: string, status: StoryReport['status'], issue = ISSUE): StoryReport => ({
  storyId,
  origin: { issue, epic: '' },
  status,
  phase: 'building',
  files: [],
  github: { state: 'not checked', on: '', detail: '' },
  next: 'nothing',
  remainingSteps: [],
  attempts: {},
  history: [],
  followUps: [],
  recorded: false,
});

describe('storiesToSync', () => {
  it('should let the live story speak for an issue that abandoned stories also point to', () => {
    const chosen = storiesToSync([report('old-1', 'abandoned'), report('live', 'ready-for-commit'), report('old-2', 'abandoned')]);

    expect(chosen.map(({ storyId }) => storyId)).toEqual(['live']);
  });

  it('should still show an abandoned story when nothing else points to its issue', () => {
    expect(storiesToSync([report('old', 'abandoned')]).map(({ storyId }) => storyId)).toEqual(['old']);
  });

  it('should skip a story that has no issue', () => {
    expect(storiesToSync([report('loose', 'working', '')])).toEqual([]);
  });
});

describe('advanceSingleStory and confirmStoryOrEpic', () => {
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
      { step: 'review', when: 'always' },
    ],
    commands: {},
  };

  function setupFlow() {
    const versions = new Map<string, number>();
    const tracker: ChangeTracker = {
      fingerprint: async () => Object.fromEntries([...versions.entries()].map(([file, count]) => [file, String(count)])),
      changedSince: async (since) =>
        [...versions.entries()]
          .filter(([file, count]) => String(count) !== since[file])
          .map(([file]) => ({ repository: '.', file, alreadyDirty: file in since })),
    };
    const graph = buildFlowGraph(
      { workspaceRoot: '/workspace', sheets: { read: async () => sheet }, contractsDirectory: '/contracts', changesOf: () => tracker, activeStories: NO_OTHER_STORIES },
      new MemorySaver(),
    );
    const flow = new StoryFlow(graph).withChanges({ changesOf: () => tracker, activeStories: NO_OTHER_STORIES });
    return {
      flow,
      edit: (file: string) => versions.set(file, (versions.get(file) ?? 0) + 1),
    };
  }

  it('should refuse per-story advance_to_commit when multiple stories of the same epic are ready to commit', async () => {
    const { flow, edit } = setupFlow();
    const { storyId: s1 } = await flow.startStory({ project: 'demo', title: 'One', criteria: ['C1'] }, { issue: ISSUE, epic: EPIC });
    await flow.submit(s1, { files: [FILE_1], conditions: [] });
    edit(FILE_1);
    await flow.submit(s1, { summary: 'one' });
    const { storyId: s2 } = await flow.startStory({ project: 'demo', title: 'Two', criteria: ['C2'] }, { issue: ISSUE_2, epic: EPIC });
    await flow.submit(s2, { files: [FILE_2], conditions: [] });
    edit(FILE_2);
    await flow.submit(s2, { summary: 'two' });
    const workspace: StoryWorkspace = { storyIds: () => [s1, s2], uncommittedAmong: async () => [] };

    await expect(advanceSingleStory(flow, workspace, s1)).rejects.toThrow('advance_epic_to_commit');

    const epicRun = await flow.advanceEpicToCommit(EPIC, [s1, s2]);
    await flow.submit(epicRun.storyId, { findings: [] });
    const confirmed = await confirmStoryOrEpic(flow, { storyIds: () => [s1, s2, epicRun.storyId], uncommittedAmong: async () => [] }, epicRun.storyId);
    expect(confirmed.confirmed?.map(({ storyId }) => storyId)).toEqual([s1, s2]);
  });
});

describe('ensureNoPendingDecision and syncedStories with decision runs', () => {
  const pendingDecision: DecisionRunRecord = {
    runId: 'solution-architect~d1',
    agent: 'solution-architect',
    finishedOn: '2026-11-26T00:32:19.000Z',
    linkedIssues: ['https://github.com/demo/site/issues/78', 'https://github.com/demo/site/issues/79'],
    repositories: ['demo/site'],
    requiredFollowUp: {
      agent: 'project-manager',
      noApprovalAgent: 'issue-review',
      issues: ['https://github.com/demo/site/issues/78', 'https://github.com/demo/site/issues/79'],
      repositories: ['demo/site'],
      reason: 'Decision run finished with no commit.',
      instruction: 'Run /issue-review or /project-manager immediately.',
    },
    followUpStatus: 'pending',
  };

  it('should block starting a story for the same epic or repository until the decision run is reviewed', () => {
    expect(() =>
      ensureNoPendingDecision(
        { issue: 'https://github.com/demo/site/issues/80', epic: 'https://github.com/demo/site/issues/78' },
        [pendingDecision],
      ),
    ).toThrow(PendingDecisionReviewError);

    expect(() =>
      ensureNoPendingDecision(
        { issue: 'https://github.com/demo/other/issues/5', epic: '' },
        [pendingDecision],
      ),
    ).not.toThrow();

    expect(() =>
      ensureNoPendingDecision(
        { issue: 'https://github.com/demo/site/issues/80', epic: 'https://github.com/demo/site/issues/78' },
        [{ ...pendingDecision, followUpStatus: 'reviewed' }],
      ),
    ).not.toThrow();
  });

  it('should include finished decision runs in sync_github output', async () => {
    const emptyTracker: ChangeTracker = { fingerprint: async () => ({}), changedSince: async () => [] };
    const flow = new StoryFlow(
      buildFlowGraph(
        {
          workspaceRoot: '/workspace',
          sheets: {
            read: async () => ({
              project: 'demo',
              path: 'apps/demo',
              commitScope: 'demo',
              sheetFile: 'demo.md',
              reuses: [],
              specialist: 'agents/specialist.md',
              agents: [],
              triggers: [],
              mandatorySteps: [{ step: 'implement', when: 'always' }],
              commands: {},
            }),
          },
          contractsDirectory: '/contracts',
          changesOf: () => emptyTracker,
          activeStories: NO_OTHER_STORIES,
        },
        new MemorySaver(),
      ),
    );
    const sync = await syncedStories(flow, {
      storyIds: () => [],
      uncommittedAmong: async () => [],
      decisionRuns: () => [pendingDecision],
    });

    expect(sync).toMatchObject({
      allUpToDate: true,
      stories: [],
      decisionRuns: [
        {
          runId: 'solution-architect~d1',
          agent: 'solution-architect',
          linkedIssues: ['https://github.com/demo/site/issues/78', 'https://github.com/demo/site/issues/79'],
          followUpStatus: 'pending',
        },
      ],
    });
  });
});
