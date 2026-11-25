import { randomUUID } from 'node:crypto';
import { Command } from '@langchain/langgraph';
import { stepQueue, type Story } from './domain/plan.js';
import { isCommitGateStep, isStepName, type StepName } from './domain/steps.js';
import type { FlowGraph } from './flow/graph.js';
import type { Instruction } from './flow/instructions.js';
import { stageOf, type IssueStage, type StoryPhase } from './backlog/issue-stage.js';
import { NOT_SYNCING, type GithubSync, type IssueSync } from './backlog/issue-sync.js';
import { NOT_RECORDING, type FlowJournal } from './journal/flow-journal.js';
import { NO_ORIGIN, type HistoryEntry, type FlowStateValue, type StoryOrigin, type StoryStatus } from './flow/state.js';

export interface StoryReport {
  readonly storyId: string;
  readonly origin: StoryOrigin;
  readonly status: StoryStatus;
  readonly phase: StoryPhase;
  readonly files: readonly string[];
  readonly github: GithubSync;
  readonly next: Instruction | 'nothing';
  readonly remainingSteps: readonly (StepName | 'plan')[];
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
const ADVANCEABLE: ReadonlySet<StoryStatus> = new Set(['working', 'ready-for-commit']);

const NOT_CHECKED: GithubSync = { state: 'not checked', on: '', detail: 'GitHub was not updated since the flow engine started' };

export class StoryFlow {
  private readonly lastSync = new Map<string, GithubSync>();

  constructor(
    private readonly graph: FlowGraph,
    private readonly journal: FlowJournal = NOT_RECORDING,
    private readonly issues: IssueSync = NOT_SYNCING,
  ) {}

  async startStory(story: Story, origin: StoryOrigin = NO_ORIGIN): Promise<StoryReport> {
    const storyId = `${story.project}-${randomUUID().slice(0, 8)}`;
    await this.graph.invoke({ story, origin }, configOf(storyId));
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
    return { ...after, recorded };
  }

  async resume(storyId: string, decision = ''): Promise<StoryReport> {
    const plan = (await this.graph.getState(configOf(storyId))).values['plan'] as FlowStateValue['plan'] | undefined;
    const withDecision = plan === undefined || decision.trim() === '' ? {} : { plan: { ...plan, brief: `${plan.brief}\n\nThe user decided: ${decision.trim()}` } };
    const stoppedWhilePlanning = (await this.report(storyId)).history.at(-1)?.step === 'plan';
    return this.continued(storyId, RESUMABLE, { status: stoppedWhilePlanning ? 'planning' : 'working', attempts: {}, ...withDecision });
  }

  async advanceToCommit(storyId: string): Promise<StoryReport> {
    return this.continued(storyId, ADVANCEABLE, { status: 'working', commitRequested: true });
  }

  async holdForCommit(storyId: string): Promise<StoryReport> {
    const before = await this.report(storyId);
    if (!ADVANCEABLE.has(before.status) && before.status !== 'ready-for-commit') {
      throw new StoryNotWaitingError(storyId, before.status, 'working or ready-for-commit');
    }
    await this.graph.updateState(
      configOf(storyId),
      { commitRequested: false, status: 'ready-for-commit' },
      before.next === 'nothing' ? lastNodeOf(before) : undefined,
    );
    return this.synced(await this.report(storyId), stageOfReport(before));
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
    this.lastSync.set(storyId, github);
    return { ...report, github };
  }

  async resync(storyId: string, uncommittedFiles: readonly string[]): Promise<StoryReport> {
    const report = await this.report(storyId);
    const committed = report.status === 'finished' && report.files.length > 0 && uncommittedFiles.length === 0;
    const github = committed ? await this.issues.closeDone(report.origin) : await this.issues.show(report.origin, stageOfReport(report));
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
    await this.graph.updateState(configOf(storyId), update, before.next === 'nothing' ? lastNodeOf(before) : undefined);
    await this.graph.invoke(null, configOf(storyId));
    const after = await this.synced(await this.report(storyId), stageOfReport(before));
    const recorded = await this.journal.stepsJudged({ storyId, status: after.status, entries: [] });
    return { ...after, recorded };
  }

  private async synced(report: StoryReport, stageBefore: IssueStage | undefined): Promise<StoryReport> {
    const stage = stageOfReport(report);
    if (stage === stageBefore) {
      return report;
    }
    const github = await this.issues.show(report.origin, stage);
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
    return {
      storyId,
      origin: state.origin ?? NO_ORIGIN,
      status,
      phase: state.commitRequested === true ? 'commit' : 'building',
      files: [...new Set([...(state.plan?.files ?? []), ...(state.testFiles ?? [])])],
      github: this.lastSync.get(storyId) ?? NOT_CHECKED,
      next: pending === undefined || heldForCommit || status === 'abandoned' ? 'nothing' : (pending.value as Instruction),
      remainingSteps: remainingStepsOf(state),
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
