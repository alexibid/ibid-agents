import { randomUUID } from 'node:crypto';
import { Command } from '@langchain/langgraph';
import type { Story } from './domain/plan.js';
import type { StepName } from './domain/steps.js';
import type { FlowGraph } from './flow/graph.js';
import type { Instruction } from './flow/instructions.js';
import type { HistoryEntry, FlowStateValue, StoryStatus } from './flow/state.js';

export interface StoryReport {
  readonly storyId: string;
  readonly status: StoryStatus;
  readonly next: Instruction | 'nothing';
  readonly remainingSteps: readonly StepName[];
  readonly history: readonly HistoryEntry[];
}

export class UnknownStoryError extends Error {
  constructor(storyId: string) {
    super(`No story with the id "${storyId}" is in progress.`);
    this.name = 'UnknownStoryError';
  }
}

const RECURSION_LIMIT = 200;

export class StoryFlow {
  constructor(private readonly graph: FlowGraph) {}

  async startStory(story: Story): Promise<StoryReport> {
    const storyId = `${story.project}-${randomUUID().slice(0, 8)}`;
    await this.graph.invoke({ story }, configOf(storyId));
    return this.report(storyId);
  }

  async submit(storyId: string, handedBack: unknown): Promise<StoryReport> {
    const before = await this.report(storyId);
    if (before.next === 'nothing') {
      return before;
    }
    await this.graph.invoke(new Command({ resume: handedBack }), configOf(storyId));
    return this.report(storyId);
  }

  async report(storyId: string): Promise<StoryReport> {
    const snapshot = await this.graph.getState(configOf(storyId));
    const state = snapshot.values as Partial<FlowStateValue>;
    if (state.story === undefined) {
      throw new UnknownStoryError(storyId);
    }
    const pending = snapshot.tasks.flatMap((task) => task.interrupts).at(0);
    return {
      storyId,
      status: state.status ?? 'planning',
      next: pending === undefined ? 'nothing' : (pending.value as Instruction),
      remainingSteps: (state.queue ?? []).slice(state.position ?? 0),
      history: state.history ?? [],
    };
  }
}

function configOf(storyId: string) {
  return { configurable: { thread_id: storyId }, recursionLimit: RECURSION_LIMIT };
}
