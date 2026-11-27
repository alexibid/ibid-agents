import { randomUUID } from 'node:crypto';
import { Command } from '@langchain/langgraph';
import { stepQueue, type Story } from './domain/plan.js';
import { isCommitGateStep, isStepName, type StepName } from './domain/steps.js';
import { stalePositionOf, type StalenessDependencies } from './flow/commit-staleness.js';
import type { EpicCommitOptions } from './flow/epic-commit.js';
import { confirmEpicStories, finalizeEpicMembers, runEpicCommit, type EpicRunnerContext } from './flow/epic-commit-runner.js';
import type { FlowGraph } from './flow/graph.js';
import type { Instruction } from './flow/instructions.js';
import { stageOf, type IssueStage, type StoryPhase } from './backlog/issue-stage.js';
import { NOT_SYNCING, type GithubSync, type IssueSync } from './backlog/issue-sync.js';
import { NOT_RECORDING, type FlowJournal } from './journal/flow-journal.js';
import { NO_ORIGIN, type HistoryEntry, type FlowStateValue, type StoryOrigin, type StoryStatus } from './flow/state.js';

export interface StoryReport {
  readonly storyId: string;
  readonly project?: string;
  readonly origin: StoryOrigin;
  readonly epicMembers?: readonly string[];
  readonly status: StoryStatus;
  readonly phase: StoryPhase;
  readonly commitConfirmed?: boolean;
  readonly files: readonly string[];
  readonly github: GithubSync;
  readonly next: Instruction | 'nothing';
  readonly remainingSteps: readonly (StepName | 'plan')[];
  readonly attempts: Readonly<Record<string, number>>;
  readonly history: readonly HistoryEntry[];
  readonly followUps: readonly string[];
  readonly recorded: boolean;
}

export class UnknownStoryError extends Error {
  constructor(storyId: string) {
    super(`No story with the id "${storyId}" is in progress.`);
    this.name = 'UnknownStoryError';
  }
}

export class StoryNotCommittedError extends Error {
  constructor(storyId: string, files: readonly string[]) {
    super(`The story "${storyId}" still has uncommitted files: ${files.join(', ')}.`);
    this.name = 'StoryNotCommittedError';
  }
}

export class StoryNotWaitingError extends Error {
  constructor(storyId: string, status: StoryStatus, wanted: string) {
    super(`The story "${storyId}" is ${status}; only a story that is ${wanted} can do that.`);
    this.name = 'StoryNotWaitingError';
  }
}

const RECURSION_LIMIT = 200;
const RESUMABLE: ReadonlySet<StoryStatus> = new Set(['needs-user']);
const HOLDABLE: ReadonlySet<StoryStatus> = new Set(['working', 'ready-for-commit']);
const ADVANCEABLE: ReadonlySet<StoryStatus> = new Set(['working', 'ready-for-commit', 'finished']);

const NOT_CHECKED: GithubSync = { state: 'not checked', on: '', detail: 'GitHub was not updated since the flow engine started' };

export class StoryFlow {
  private readonly lastSync = new Map<string, GithubSync>();
  private staleness: StalenessDependencies = {};

  constructor(
    private readonly graph: FlowGraph,
    private readonly journal: FlowJournal = NOT_RECORDING,
    private readonly issues: IssueSync = NOT_SYNCING,
  ) {}

  withChanges(staleness: StalenessDependencies): this {
    this.staleness = staleness;
    return this;
  }

  async startStory(story: Story, origin: StoryOrigin = NO_ORIGIN): Promise<StoryReport> {
    const storyId = `${story.project}-${randomUUID().slice(0, 8)}`;
    await this.graph.invoke({ story, origin, commitConfirmed: false }, configOf(storyId));
    const started = await this.synced(await this.report(storyId), undefined);
    const recorded = await this.journal.storyStarted({ storyId, story, status: started.status });
    return { ...started, recorded };
  }

  async submit(storyId: string, handedBack: unknown): Promise<StoryReport> {
    const before = await this.report(storyId);
    if (before.next === 'nothing') {
      return before;
    }
    await this.graph.invoke(new Command({ resume: handedBack }), configOf(storyId));
    const after = await this.synced(await this.report(storyId), stageOfReport(before));
    const entries = after.history.slice(before.history.length);
    const recorded = await this.journal.stepsJudged({ storyId, status: after.status, entries });
    const finalized = after.status === 'finished' && (after.epicMembers?.length ?? 0) > 0 ? await finalizeEpicMembers(this.epicContext(), after) : after;
    return { ...finalized, recorded };
  }

  async resume(storyId: string, decision = ''): Promise<StoryReport> {
    const values = (await this.graph.getState(configOf(storyId))).values as Partial<FlowStateValue>;
    const plan = values.plan;
    const withDecision = plan === undefined || decision.trim() === '' ? {} : { plan: { ...plan, brief: `${plan.brief}\n\nThe user decided: ${decision.trim()}` } };
    const stoppedWhilePlanning = (await this.report(storyId)).history.at(-1)?.step === 'plan';
    const commitUpdate = (values.epicMembers?.length ?? 0) > 0 ? { commitRequested: true } : {};
    return this.continued(storyId, RESUMABLE, { status: stoppedWhilePlanning ? 'planning' : 'working', attempts: {}, ...withDecision, ...commitUpdate });
  }

  async advanceToCommit(storyId: string): Promise<StoryReport> {
    const state = (await this.graph.getState(configOf(storyId))).values as Partial<FlowStateValue>;
    const stale = state.story === undefined ? undefined : await stalePositionOf(state, storyId, this.staleness);
    if (state.status === 'finished' && stale === undefined) {
      return this.report(storyId);
    }
    const update: Partial<FlowStateValue> = { status: 'working', commitRequested: true, commitConfirmed: false, ...(stale !== undefined ? { position: stale } : {}) };
    const after = await this.continued(storyId, ADVANCEABLE, update);
    return after.status === 'finished' && (after.epicMembers?.length ?? 0) > 0 ? finalizeEpicMembers(this.epicContext(), after) : after;
  }

  async advanceEpicToCommit(epic: string, candidateIds: readonly string[], options: EpicCommitOptions = {}): Promise<StoryReport> {
    return runEpicCommit(this.epicContext(), { epic, candidateIds }, options);
  }

  async confirmEpicCommit(
    epic: string,
    candidateIds: readonly string[],
    uncommittedAmong: (files: readonly string[]) => Promise<string[]>,
  ): Promise<StoryReport[]> {
    return confirmEpicStories(this.epicContext(), { epic, candidateIds }, uncommittedAmong);
  }

  async holdForCommit(storyId: string): Promise<StoryReport> {
    const before = await this.report(storyId);
    if (!HOLDABLE.has(before.status)) {
      throw new StoryNotWaitingError(storyId, before.status, 'working or ready-for-commit');
    }
    await this.graph.updateState(
      configOf(storyId),
      { commitRequested: false, status: 'ready-for-commit' },
      before.next === 'nothing' ? lastNodeOf(before) : undefined,
    );
    const after = await this.synced(await this.report(storyId), stageOfReport(before));
    const recorded = await this.journal.stepsJudged({ storyId, status: after.status, entries: [] });
    return { ...after, recorded };
  }

  async linkOrigin(storyId: string, origin: StoryOrigin): Promise<StoryReport> {
    const before = await this.report(storyId);
    await this.graph.updateState(configOf(storyId), { origin }, before.next === 'nothing' ? lastNodeOf(before) : undefined);
    if (before.next !== 'nothing') {
      await this.graph.invoke(null, configOf(storyId));
    }
    return this.synced(await this.report(storyId), undefined);
  }

  async confirmCommit(storyId: string, uncommittedFiles: readonly string[]): Promise<StoryReport> {
    const report = await this.report(storyId);
    if (report.status !== 'finished') {
      throw new StoryNotWaitingError(storyId, report.status, 'finished');
    }
    if (uncommittedFiles.length > 0) {
      throw new StoryNotCommittedError(storyId, uncommittedFiles);
    }
    const github = await this.issues.closeDone(report.origin);
    await this.markCommitConfirmed(storyId, report);
    this.lastSync.set(storyId, github);
    return { ...report, commitConfirmed: true, github };
  }

  async markCommitConfirmed(storyId: string, existing?: StoryReport): Promise<void> {
    const report = existing ?? (await this.report(storyId));
    await this.graph.updateState(configOf(storyId), { commitConfirmed: true }, report.next === 'nothing' ? lastNodeOf(report) : undefined);
  }

  async resync(storyId: string, uncommittedFiles: readonly string[]): Promise<StoryReport> {
    const report = await this.report(storyId);
    const committed = report.status === 'finished' && report.files.length > 0 && uncommittedFiles.length === 0;
    const stage = stageOfReport(report);
    const github = committed
      ? await this.issues.closeDone(report.origin)
      : stage === 'ready-for-commit' || stage === 'awaiting-commit'
        ? await this.issues.closeBuilt(report.origin, stage)
        : await this.issues.show(report.origin, stage);
    this.lastSync.set(storyId, github);
    return { ...report, github };
  }

  async abandon(storyId: string): Promise<StoryReport> {
    const before = await this.report(storyId);
    if (before.status === 'finished' || before.status === 'abandoned') {
      return before;
    }
    await this.graph.updateState(configOf(storyId), { status: 'abandoned' });
    const after = await this.synced(await this.report(storyId), stageOfReport(before));
    const recorded = await this.journal.stepsJudged({ storyId, status: after.status, entries: [] });
    return { ...after, recorded };
  }

  private async continued(
    storyId: string,
    allowed: ReadonlySet<StoryStatus>,
    update: Partial<FlowStateValue>,
  ): Promise<StoryReport> {
    const before = await this.report(storyId);
    if (!allowed.has(before.status)) {
      throw new StoryNotWaitingError(storyId, before.status, [...allowed].join(' or '));
    }
    const asNode = before.next === 'nothing' || 'position' in update ? lastNodeOf(before) : undefined;
    await this.graph.updateState(configOf(storyId), update, asNode);
    await this.graph.invoke(null, configOf(storyId));
    const after = await this.synced(await this.report(storyId), stageOfReport(before));
    const recorded = await this.journal.stepsJudged({ storyId, status: after.status, entries: [] });
    return { ...after, recorded };
  }

  private epicContext(): EpicRunnerContext {
    return {
      flow: this,
      graph: this.graph,
      journal: this.journal,
      issues: this.issues,
      staleness: () => this.staleness,
      lastNodeOf,
      recordSync: (storyId, sync) => this.lastSync.set(storyId, sync),
    };
  }

  private async synced(report: StoryReport, stageBefore: IssueStage | undefined): Promise<StoryReport> {
    const stage = stageOfReport(report);
    if (stage === stageBefore) {
      return report;
    }
    const github =
      stage === 'ready-for-commit' || stage === 'awaiting-commit'
        ? await this.issues.closeBuilt(report.origin, stage)
        : await this.issues.show(report.origin, stage);
    this.lastSync.set(report.storyId, github);
    return { ...report, github };
  }

  async report(storyId: string): Promise<StoryReport> {
    const snapshot = await this.graph.getState(configOf(storyId));
    const state = snapshot.values as Partial<FlowStateValue>;
    if (state.story === undefined) {
      throw new UnknownStoryError(storyId);
    }
    const pending = snapshot.tasks.flatMap((task) => task.interrupts).at(0);
    const heldForCommit = pending !== undefined && waitsForTheCommit(pending.value, state);
    const status = heldForCommit ? 'ready-for-commit' : (state.status ?? 'planning');
    const epicMembers = state.epicMembers ?? [];
    return {
      storyId,
      project: state.story.project,
      origin: state.origin ?? NO_ORIGIN,
      ...(epicMembers.length > 0 ? { epicMembers } : {}),
      status,
      phase: state.commitRequested === true ? 'commit' : 'building',
      ...(state.commitConfirmed === undefined ? {} : { commitConfirmed: state.commitConfirmed }),
      files: [...new Set([...(state.plan?.files ?? []), ...(state.testFiles ?? [])])],
      github: this.lastSync.get(storyId) ?? NOT_CHECKED,
      next: pending === undefined || heldForCommit || status === 'abandoned' ? 'nothing' : (pending.value as Instruction),
      remainingSteps: remainingStepsOf(state),
      attempts: state.attempts ?? {},
      history: state.history ?? [],
      followUps: state.followUps ?? [],
      recorded: false,
    };
  }
}

function remainingStepsOf(state: Partial<FlowStateValue>): (StepName | 'plan')[] {
  if (state.status === 'abandoned') {
    return [];
  }
  if ((state.status ?? 'planning') !== 'planning') {
    return (state.queue ?? []).slice(state.position ?? 0);
  }
  const stepsEveryPlanRuns = state.sheet === undefined ? [] : stepQueue(state.sheet, []);
  return ['plan', ...stepsEveryPlanRuns];
}

function waitsForTheCommit(instruction: unknown, state: Partial<FlowStateValue>): boolean {
  const step = typeof instruction === 'object' && instruction !== null && 'step' in instruction ? instruction.step : '';
  return typeof step === 'string' && isStepName(step) && isCommitGateStep(step) && state.commitRequested !== true;
}

function stageOfReport(report: StoryReport): IssueStage {
  return stageOf(report.status, report.phase);
}

function lastNodeOf(report: StoryReport): string {
  const lastStep = report.history.at(-1)?.step ?? 'plan';
  return lastStep === 'plan' ? 'planning' : lastStep;
}

function configOf(storyId: string) {
  return { configurable: { thread_id: storyId }, recursionLimit: RECURSION_LIMIT };
}
