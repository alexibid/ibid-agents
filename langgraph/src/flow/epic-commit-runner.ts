import { randomUUID } from 'node:crypto';
import type { IssueSync } from '../backlog/issue-sync.js';
import type { FlowJournal } from '../journal/flow-journal.js';
import type { StoryFlow, StoryReport } from '../story-flow.js';
import { StoryNotCommittedError } from '../story-flow.js';
import type { StalenessDependencies } from './commit-staleness.js';
import {
  epicCommitUpdate,
  EpicNotReadyError,
  memberFromState,
  pendingProjectFilesFor,
  sameMemberSet,
  selectEpicBatch,
  type EpicCommitOptions,
  type EpicMember,
} from './epic-commit.js';
import type { FlowGraph } from './graph.js';
import type { FlowStateValue } from './state.js';

export interface EpicRunnerContext {
  readonly flow: StoryFlow;
  readonly graph: FlowGraph;
  readonly journal: FlowJournal;
  readonly issues: IssueSync;
  readonly staleness: () => StalenessDependencies;
  readonly lastNodeOf: (report: StoryReport) => string;
  readonly recordSync: (storyId: string, sync: Awaited<ReturnType<IssueSync['closeBuilt']>>) => void;
}

const RECURSION_LIMIT = 200;

export async function runEpicCommit(
  context: EpicRunnerContext,
  epicSpec: { readonly epic: string; readonly candidateIds: readonly string[] },
  options: EpicCommitOptions = {},
): Promise<StoryReport> {
  const entries = await epicEntries(context.graph, epicSpec.candidateIds);
  const { members, existingRuns } = await selectEpicBatch(epicSpec.epic, entries, options);
  const memberIds = members.map(({ storyId }) => storyId);
  const matching = [...existingRuns].reverse().find((run) => sameMemberSet(run.epicMembers, memberIds));
  await holdCommitMembers(context.flow, members);
  if (matching !== undefined) {
    return context.flow.advanceToCommit(matching.storyId);
  }
  for (const run of existingRuns) {
    await context.flow.abandon(run.storyId);
  }
  const { pendingFiles, currentFingerprint } = await pendingProjectFilesFor(members, context.staleness().changesOf);
  const { update, story } = epicCommitUpdate({ epic: epicSpec.epic, members, pendingFiles, currentFingerprint });
  const epicCommitId = `${members[0]?.story.project ?? 'epic'}-epic-${randomUUID().slice(0, 8)}`;
  await context.graph.updateState(configOf(epicCommitId), update, 'planning');
  await context.graph.invoke(null, configOf(epicCommitId));
  const after = await context.flow.report(epicCommitId);
  const recorded =
    (await context.journal.storyStarted({ storyId: epicCommitId, story, status: after.status })) &&
    (await context.journal.stepsJudged({ storyId: epicCommitId, status: after.status, entries: after.history }));
  const finalized = after.status === 'finished' ? await finalizeEpicMembers(context, after) : after;
  return { ...finalized, recorded };
}

export async function confirmEpicStories(
  context: EpicRunnerContext,
  epicSpec: { readonly epic: string; readonly candidateIds: readonly string[] },
  uncommittedAmong: (files: readonly string[]) => Promise<string[]>,
): Promise<StoryReport[]> {
  const reports = await Promise.all(epicSpec.candidateIds.map((id) => context.flow.report(id).catch(() => undefined)));
  const active = reports.filter(
    (entry): entry is StoryReport => entry !== undefined && entry.origin.epic === epicSpec.epic && entry.status !== 'abandoned',
  );
  const finished = active.filter(({ status }) => status === 'finished');
  if (finished.length === 0) {
    throw new EpicNotReadyError(`No finished stories in epic "${epicSpec.epic}" are waiting for commit confirmation.`);
  }
  const allFiles = [...new Set(finished.flatMap(({ files }) => files))];
  const uncommitted = await uncommittedAmong(allFiles);
  if (uncommitted.length > 0) {
    throw new StoryNotCommittedError(finished[0]?.storyId ?? epicSpec.epic, uncommitted);
  }
  const realFinished = finished.filter(({ origin, epicMembers }) => origin.issue !== '' && (epicMembers?.length ?? 0) === 0);
  const confirmed: StoryReport[] = [];
  for (const entry of realFinished) {
    confirmed.push(await context.flow.confirmCommit(entry.storyId, []));
  }
  const remaining = finished.filter((entry) => !realFinished.some(({ storyId }) => storyId === entry.storyId));
  for (const entry of remaining) {
    await context.flow.markCommitConfirmed(entry.storyId);
  }
  return confirmed;
}

export async function finalizeEpicMembers(context: EpicRunnerContext, epicReport: StoryReport): Promise<StoryReport> {
  for (const memberId of epicReport.epicMembers ?? []) {
    const snapshot = await context.graph.getState(configOf(memberId));
    const state = snapshot.values as Partial<FlowStateValue>;
    const member = await context.flow.report(memberId);
    if (member.status === 'finished' || member.status === 'abandoned') {
      continue;
    }
    await context.graph.updateState(
      configOf(memberId),
      { status: 'finished', commitRequested: true, commitConfirmed: false, position: state.queue?.length ?? 0 },
      member.next === 'nothing' ? context.lastNodeOf(member) : undefined,
    );
    const github = await context.issues.closeBuilt(member.origin, 'awaiting-commit');
    context.recordSync(memberId, github);
    await context.journal.stepsJudged({ storyId: memberId, status: 'finished', entries: [] });
  }
  return epicReport;
}

async function epicEntries(graph: FlowGraph, candidateIds: readonly string[]): Promise<EpicMember[]> {
  const snapshots = await Promise.all(candidateIds.map(async (id) => ({ id, snap: await graph.getState(configOf(id)) })));
  return snapshots.flatMap(({ id, snap }) => {
    const member = memberFromState(id, snap.values as Partial<FlowStateValue>);
    return member === undefined ? [] : [member];
  });
}

async function holdCommitMembers(flow: StoryFlow, members: readonly EpicMember[]): Promise<void> {
  for (const member of members) {
    if (member.status === 'working' && member.commitRequested) {
      await flow.holdForCommit(member.storyId);
    }
  }
}

function configOf(storyId: string) {
  return { configurable: { thread_id: storyId }, recursionLimit: RECURSION_LIMIT };
}
