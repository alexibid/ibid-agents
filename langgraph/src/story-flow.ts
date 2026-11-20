import { randomUUID } from 'node:crypto';
import { Command } from '@langchain/langgraph';
import { stepQueue, type Story } from './domain/plan.js';
import type { StepName } from './domain/steps.js';
import type { FlowGraph } from './flow/graph.js';
import type { Instruction } from './flow/instructions.js';
import { NOT_RECORDING, type FlowJournal } from './journal/flow-journal.js';
import type { HistoryEntry, FlowStateValue, StoryStatus } from './flow/state.js';

export interface StoryReport {
  readonly storyId: string;
  readonly status: StoryStatus;
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

const RECURSION_LIMIT = 200;

export class StoryFlow {
  constructor(
    private readonly graph: FlowGraph,
    private readonly journal: FlowJournal = NOT_RECORDING,
  ) {}

  async startStory(story: Story): Promise<StoryReport> {
    const storyId = `${story.project}-${randomUUID().slice(0, 8)}`;
    await this.graph.invoke({ story }, configOf(storyId));
    const started = await this.report(storyId);
    const recorded = await this.journal.storyStarted({ storyId, story, status: started.status });
    return { ...started, recorded };
  }

  async submit(storyId: string, handedBack: unknown): Promise<StoryReport> {
    const before = await this.report(storyId);
    if (before.next === 'nothing') {
      return before;
    }
    await this.graph.invoke(new Command({ resume: handedBack }), configOf(storyId));
    const after = await this.report(storyId);
    const entries = after.history.slice(before.history.length);
    const recorded = await this.journal.stepsJudged({ storyId, status: after.status, entries });
    return { ...after, recorded };
  }

  async abandon(storyId: string): Promise<StoryReport> {
    const before = await this.report(storyId);
    if (before.status === 'finished' || before.status === 'abandoned') {
      return before;
    }
    await this.graph.updateState(configOf(storyId), { status: 'abandoned' });
    const after = await this.report(storyId);
    const recorded = await this.journal.stepsJudged({ storyId, status: after.status, entries: [] });
    return { ...after, recorded };
  }

  async report(storyId: string): Promise<StoryReport> {
    const snapshot = await this.graph.getState(configOf(storyId));
    const state = snapshot.values as Partial<FlowStateValue>;
    if (state.story === undefined) {
      throw new UnknownStoryError(storyId);
    }
    const pending = snapshot.tasks.flatMap((task) => task.interrupts).at(0);
    const status = state.status ?? 'planning';
    return {
      storyId,
      status,
      next: pending === undefined || status === 'abandoned' ? 'nothing' : (pending.value as Instruction),
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

function configOf(storyId: string) {
  return { configurable: { thread_id: storyId }, recursionLimit: RECURSION_LIMIT };
}
