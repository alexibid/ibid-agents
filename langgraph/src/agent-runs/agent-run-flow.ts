import { randomUUID } from 'node:crypto';
import { Command, type BaseCheckpointSaver } from '@langchain/langgraph';
import type { AgentFlowDefinition } from './definition.js';
import { buildAgentRunGraph, type AgentRunGraph, type RunInstruction } from './graph.js';
import { KEEPS_NOTHING, type ResultKeeper } from './result-keeper.js';
import { NOT_RECORDING_RUNS, type RunJournal } from './run-journal.js';
import type { AgentRunStateValue, RunHistoryEntry, RunStatus } from './state.js';

export interface RunReport {
  readonly runId: string;
  readonly agent: string;
  readonly status: RunStatus;
  readonly next: RunInstruction | 'nothing';
  readonly history: readonly RunHistoryEntry[];
  readonly recorded: boolean;
}

export class UnknownAgentFlowError extends Error {
  constructor(agent: string, known: readonly string[]) {
    super(`"${agent}" has no flow. Agents with a flow: ${known.join(', ')}.`);
    this.name = 'UnknownAgentFlowError';
  }
}

export class UnknownRunError extends Error {
  constructor(runId: string) {
    super(`No agent run with the id "${runId}" exists.`);
    this.name = 'UnknownRunError';
  }
}

const RECURSION_LIMIT = 200;
const SEPARATOR = '~';

export class AgentRunFlow {
  readonly #graphs: ReadonlyMap<string, AgentRunGraph>;
  readonly #definitions: ReadonlyMap<string, AgentFlowDefinition>;

  constructor(
    definitions: readonly AgentFlowDefinition[],
    checkpointer: BaseCheckpointSaver,
    private readonly journal: RunJournal = NOT_RECORDING_RUNS,
    private readonly keeper: ResultKeeper = KEEPS_NOTHING,
  ) {
    this.#graphs = new Map(definitions.map((definition) => [definition.agent, buildAgentRunGraph(definition, checkpointer)]));
    this.#definitions = new Map(definitions.map((definition) => [definition.agent, definition]));
  }

  async start(agent: string, request: string): Promise<RunReport> {
    const runId = `${agent}${SEPARATOR}${randomUUID().slice(0, 8)}`;
    await this.#graphOf(agent).invoke({ agent, request }, configOf(runId));
    const recorded = await this.journal.started({ runId, agent, request });
    return { ...(await this.report(runId)), recorded };
  }

  async submit(runId: string, handedBack: unknown): Promise<RunReport> {
    const before = await this.report(runId);
    if (before.next === 'nothing') {
      return before;
    }
    await this.#graphOf(before.agent).invoke(new Command({ resume: handedBack }), configOf(runId));
    const after = await this.report(runId);
    const entries = after.history.slice(before.history.length);
    const recorded = await this.journal.judged({ runId, status: after.status, entries });
    const kept = await this.#keepPassed(before, entries, handedBack);
    return { ...after, recorded: recorded && kept };
  }

  async abandon(runId: string): Promise<RunReport> {
    const before = await this.report(runId);
    if (before.status === 'finished' || before.status === 'abandoned') {
      return before;
    }
    await this.#graphOf(before.agent).updateState(configOf(runId), { status: 'abandoned' });
    const after = await this.report(runId);
    const recorded = await this.journal.judged({ runId, status: after.status, entries: [] });
    return { ...after, recorded };
  }

  async #keepPassed(before: RunReport, entries: readonly RunHistoryEntry[], handedBack: unknown): Promise<boolean> {
    const passed = entries.find((entry) => entry.passed);
    const step = this.#definitions.get(before.agent)?.steps.find((candidate) => candidate.id === passed?.step);
    if (step === undefined || before.next === 'nothing' || typeof handedBack !== 'object' || handedBack === null) {
      return true;
    }
    const given = Object.fromEntries(Object.entries(handedBack));
    return this.keeper.keep({ runId: before.runId, step, handedBack: given, earlier: before.next.earlierResults });
  }

  async report(runId: string): Promise<RunReport> {
    const agent = runId.split(SEPARATOR)[0] ?? '';
    const snapshot = await this.#graphOf(agent).getState(configOf(runId));
    const state = snapshot.values as Partial<AgentRunStateValue>;
    if (state.agent === undefined) {
      throw new UnknownRunError(runId);
    }
    const pending = snapshot.tasks.flatMap((task) => task.interrupts).at(0);
    const status = state.status ?? 'working';
    return {
      runId,
      agent,
      status,
      next: pending === undefined || status === 'abandoned' ? 'nothing' : (pending.value as RunInstruction),
      history: state.history ?? [],
      recorded: false,
    };
  }

  #graphOf(agent: string): AgentRunGraph {
    const graph = this.#graphs.get(agent);
    if (graph === undefined) {
      throw new UnknownAgentFlowError(agent, [...this.#graphs.keys()]);
    }
    return graph;
  }
}

function configOf(runId: string) {
  return { configurable: { thread_id: runId }, recursionLimit: RECURSION_LIMIT };
}
