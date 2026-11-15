import { randomUUID } from 'node:crypto';
import { Command } from '@langchain/langgraph';
import type { CoachGraph } from './coach/graph.js';
import type { CoachInstruction } from './coach/instructions.js';
import type { CoachGoal, CoachHistoryEntry, CoachStateValue, CoachStatus, LessonBlock } from './coach/state.js';

export interface CoachReport {
  readonly sessionId: string;
  readonly status: CoachStatus;
  readonly next: CoachInstruction | 'nothing';
  readonly lessonBlocks: readonly LessonBlock[];
  readonly history: readonly CoachHistoryEntry[];
}

export class UnknownCoachingSessionError extends Error {
  constructor(sessionId: string) {
    super(`No coaching session with the id "${sessionId}" is in progress.`);
    this.name = 'UnknownCoachingSessionError';
  }
}

const RECURSION_LIMIT = 200;

export class CoachFlow {
  constructor(private readonly graph: CoachGraph) {}

  async startCoaching(goal: CoachGoal): Promise<CoachReport> {
    const sessionId = `coach-${randomUUID().slice(0, 8)}`;
    await this.graph.invoke({ goal }, configOf(sessionId));
    return this.report(sessionId);
  }

  async submit(sessionId: string, handedBack: unknown): Promise<CoachReport> {
    const before = await this.report(sessionId);
    if (before.next === 'nothing') {
      return before;
    }
    await this.graph.invoke(new Command({ resume: handedBack }), configOf(sessionId));
    return this.report(sessionId);
  }

  async report(sessionId: string): Promise<CoachReport> {
    const snapshot = await this.graph.getState(configOf(sessionId));
    const state = snapshot.values as Partial<CoachStateValue>;
    if (state.goal === undefined) {
      throw new UnknownCoachingSessionError(sessionId);
    }
    const pending = snapshot.tasks.flatMap((task) => task.interrupts).at(0);
    return {
      sessionId,
      status: state.status ?? 'designing',
      next: pending === undefined ? 'nothing' : (pending.value as CoachInstruction),
      lessonBlocks: state.blocks ?? [],
      history: state.history ?? [],
    };
  }
}

function configOf(sessionId: string) {
  return { configurable: { thread_id: sessionId }, recursionLimit: RECURSION_LIMIT };
}
