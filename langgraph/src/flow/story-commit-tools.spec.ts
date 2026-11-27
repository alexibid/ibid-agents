import { MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';
import { AgentRunFlow } from '../agent-runs/agent-run-flow.js';
import { startAgentRun } from '../agent-runs/agent-run-tools.js';
import type { DecisionRunRecord } from '../agent-runs/decision-issues.js';
import { definitionOf } from '../agent-runs/definition.js';
import type { ChangeTracker, ChangedFile, Fingerprint } from '../checks/workspace-changes.js';
import { NO_OTHER_STORIES } from '../domain/concurrent-stories.js';
import type { ProjectSheet } from '../domain/sheet.js';
import { StoryFlow, StoryNotCommittedError } from '../story-flow.js';
import { buildFlowGraph } from './graph.js';
import {
  confirmStoryOrEpic,
  ensureCommitConfirmedBeforeIssueWork,
  PendingCommitConfirmationError,
} from './story-commit-tools.js';
import type { StoryWorkspace } from './story-tools.js';

const EPIC_40 = 'https://github.com/demo/site/issues/40';
const ISSUE_41 = 'https://github.com/demo/site/issues/41';
const ISSUE_42 = 'https://github.com/demo/site/issues/42';
const EPIC_98 = 'https://github.com/demo/site/issues/98';
const ISSUE_99 = 'https://github.com/demo/site/issues/99';
const FILE_1 = 'apps/demo/src/a.ts';
const FILE_2 = 'apps/demo/src/b.ts';
const EXTRA_SCSS = 'apps/demo/src/extra.scss';

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

function setupEnv() {
  const versions = new Map<string, number>();
  const dirty = new Set<string>();
  const tracker: ChangeTracker = {
    fingerprint: async (): Promise<Fingerprint> =>
      Object.fromEntries([...versions.entries()].map(([file, count]) => [file, String(count)])),
    changedSince: async (since): Promise<ChangedFile[]> =>
      [...versions.entries()]
        .filter(([file, count]) => String(count) !== since[file])
        .map(([file]) => ({ repository: '.', file, alreadyDirty: file in since })),
  };
  const graph = buildFlowGraph(
    { workspaceRoot: '/workspace', sheets: { read: async () => sheet }, contractsDirectory: '/contracts', changesOf: () => tracker, activeStories: NO_OTHER_STORIES },
    new MemorySaver(),
  );
  const flow = new StoryFlow(graph).withChanges({ changesOf: () => tracker, activeStories: NO_OTHER_STORIES });
  const edit = (file: string) => {
    versions.set(file, (versions.get(file) ?? 0) + 1);
    dirty.add(file);
  };
  const buildStory = async (title: string, file: string, origin: { issue: string; epic: string }) => {
    const { storyId } = await flow.startStory({ project: 'demo', title, criteria: ['C1'] }, origin);
    await flow.submit(storyId, { files: [file], conditions: [] });
    edit(file);
    await flow.submit(storyId, { summary: title });
    return storyId;
  };
  const finishStory = async (title: string, file: string, origin = { issue: ISSUE_41, epic: EPIC_40 }) => {
    const storyId = await buildStory(title, file, origin);
    await flow.advanceToCommit(storyId);
    await flow.submit(storyId, { findings: [] });
    return storyId;
  };
  return {
    flow,
    graph,
    edit,
    buildStory,
    finishStory,
    commit: (...files: string[]) => files.forEach((file) => dirty.delete(file)),
    uncommittedAmong: async (files: readonly string[]) => files.filter((file) => dirty.has(file)),
  };
}

function agentFlow() {
  const step = (doneBy: string) => [{ id: 'work', name: 'Work', doneBy, task: 'Work.', fields: { summary: 'text' } }];
  return new AgentRunFlow(
    [
      definitionOf('project-manager', JSON.stringify({ title: 'PM', steps: step('project-manager') }), '/skills/pm/SKILL.md'),
      definitionOf('issue-review', JSON.stringify({ title: 'IR', steps: step('issue-review') }), '/skills/ir/SKILL.md'),
      definitionOf('devops', JSON.stringify({ title: 'DO', steps: step('devops') }), '/skills/devops/SKILL.md'),
    ],
    new MemorySaver(),
  );
}

describe('confirmStoryOrEpic and post-commit ordering guard', () => {
  it('should check extraFiles added during an epic commit run and mark both the epic run and members confirmed', async () => {
    const env = setupEnv();
    const s1 = await env.buildStory('One', FILE_1, { issue: ISSUE_41, epic: EPIC_40 });
    const s2 = await env.buildStory('Two', FILE_2, { issue: ISSUE_42, epic: EPIC_40 });

    const epicRun = await env.flow.advanceEpicToCommit(EPIC_40, [s1, s2]);
    await env.flow.submit(epicRun.storyId, { findings: [{ rule: 'W14', file: FILE_1, description: 'fix extra', blocking: true }] });
    env.edit(EXTRA_SCSS);
    await env.flow.submit(epicRun.storyId, { summary: 'added extra', extraFiles: [{ file: EXTRA_SCSS, reason: 'needed by fix' }] });
    const finished = await env.flow.submit(epicRun.storyId, { findings: [] });
    expect(finished.status).toBe('finished');
    expect(finished.commitConfirmed).toBe(false);

    env.commit(FILE_1, FILE_2);
    const workspace: StoryWorkspace = { storyIds: () => [s1, s2, epicRun.storyId], uncommittedAmong: env.uncommittedAmong };
    await expect(confirmStoryOrEpic(env.flow, workspace, epicRun.storyId)).rejects.toThrow(StoryNotCommittedError);
    await expect(confirmStoryOrEpic(env.flow, workspace, s1)).rejects.toThrow(StoryNotCommittedError);

    env.commit(EXTRA_SCSS);
    const confirmed = await confirmStoryOrEpic(env.flow, workspace, s1);
    expect(confirmed.confirmed?.map(({ storyId }) => storyId)).toEqual([s1, s2]);
    expect((await env.flow.report(epicRun.storyId)).commitConfirmed).toBe(true);
    expect((await env.flow.report(s1)).commitConfirmed).toBe(true);
    expect((await env.flow.report(s2)).commitConfirmed).toBe(true);
  });

  it('should block /project-manager follow-ups and /issue-review until the user commits and confirm_commit / confirm_epic_commit runs', async () => {
    const env = setupEnv();
    const storyId = await env.finishStory('Fix form', FILE_1);
    const workspace: StoryWorkspace = { storyIds: () => [storyId], uncommittedAmong: env.uncommittedAmong };
    const runs = agentFlow();
    const guard = (attempt: Parameters<typeof ensureCommitConfirmedBeforeIssueWork>[2]) =>
      ensureCommitConfirmedBeforeIssueWork(env.flow, workspace, attempt);

    const blockedPm = await startAgentRun(
      runs,
      { agent: 'project-manager', request: 'Close decision issue #79 (D1 for Epic #40) and evaluate/file follow-up issues in demo/site', issue: '', epic: '' },
      guard,
    );
    expect(blockedPm).toMatchObject({ isError: true });
    expect(blockedPm.content[0]?.text).toContain('confirm_epic_commit');

    expect(await startAgentRun(runs, { agent: 'issue-review', request: 'demo/site', issue: '', epic: '' }, guard)).toMatchObject({ isError: true });
    expect(await startAgentRun(runs, { agent: 'devops', request: 'Validate Dependabot and CI for demo/site', issue: '', epic: '' }, guard)).not.toHaveProperty('isError');

    env.commit(FILE_1);
    await expect(guard({ agent: 'project-manager', request: `Follow-ups of finished story ${storyId}: Fix form`, issue: '', epic: '' })).rejects.toThrow(
      PendingCommitConfirmationError,
    );

    await confirmStoryOrEpic(env.flow, workspace, storyId);
    expect(await startAgentRun(runs, { agent: 'project-manager', request: `Follow-ups of finished story ${storyId}: Fix form`, issue: '', epic: '' }, guard)).not.toHaveProperty('isError');
    expect(await startAgentRun(runs, { agent: 'issue-review', request: 'demo/site', issue: '', epic: '' }, guard)).not.toHaveProperty('isError');
  });

  it('should still allow unrelated projects, new unrelated epics, and independent pure non-code decision runs', async () => {
    const env = setupEnv();
    const storyId = await env.finishStory('Fix form', FILE_1);
    const pendingDecision: DecisionRunRecord = {
      runId: 'solution-architect~new',
      agent: 'solution-architect',
      finishedOn: '2026-11-27T12:00:00.000Z',
      linkedIssues: [ISSUE_99, EPIC_98],
      repositories: ['demo/site'],
      requiredFollowUp: { agent: 'project-manager', noApprovalAgent: 'issue-review', issues: [ISSUE_99, EPIC_98], repositories: ['demo/site'], reason: 'Done.', instruction: 'Close #99.' },
      followUpStatus: 'pending',
    };
    const workspace: StoryWorkspace = { storyIds: () => [storyId], uncommittedAmong: env.uncommittedAmong, decisionRuns: () => [pendingDecision] };

    await expect(ensureCommitConfirmedBeforeIssueWork(env.flow, workspace, { agent: 'issue-review', request: 'other/repo', issue: '', epic: '' })).resolves.toBeUndefined();
    await expect(ensureCommitConfirmedBeforeIssueWork(env.flow, workspace, { agent: 'project-manager', request: 'Create an SEO epic for demo/site', issue: '', epic: '' })).resolves.toBeUndefined();
    await expect(
      ensureCommitConfirmedBeforeIssueWork(env.flow, workspace, { agent: 'issue-review', request: `Close decision ${ISSUE_99} for ${EPIC_98}`, issue: ISSUE_99, epic: EPIC_98 }),
    ).resolves.toBeUndefined();
  });

  it('should catch legacy uncommitted finished stories with an origin while ignoring legacy origin-less stories', async () => {
    const env = setupEnv();
    const legacyWithOrigin = await env.finishStory('Legacy epic story', FILE_1);
    await env.graph.updateState({ configurable: { thread_id: legacyWithOrigin } }, { commitConfirmed: undefined }, 'review');
    const originLess = await env.finishStory('Old pre-issue', 'package.json', { issue: '', epic: '' });
    await env.graph.updateState({ configurable: { thread_id: originLess } }, { commitConfirmed: undefined }, 'review');

    const workspace: StoryWorkspace = { storyIds: () => [legacyWithOrigin, originLess], uncommittedAmong: env.uncommittedAmong };
    await expect(ensureCommitConfirmedBeforeIssueWork(env.flow, workspace, { agent: 'issue-review', request: 'demo/site', issue: '', epic: '' })).rejects.toThrow(
      PendingCommitConfirmationError,
    );

    env.commit(FILE_1);
    await expect(ensureCommitConfirmedBeforeIssueWork(env.flow, workspace, { agent: 'issue-review', request: 'demo/site', issue: '', epic: '' })).resolves.toBeUndefined();
  });
});
