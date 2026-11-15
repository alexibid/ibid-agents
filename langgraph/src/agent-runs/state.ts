import { Annotation } from '@langchain/langgraph';

export type RunStatus = 'working' | 'finished' | 'needs-user';

export interface RunHistoryEntry {
  readonly step: string;
  readonly passed: boolean;
  readonly details: readonly string[];
}

export const AgentRunState = Annotation.Root({
  agent: Annotation<string>(),
  request: Annotation<string>(),
  status: Annotation<RunStatus>({ reducer: (_previous, next) => next, default: () => 'working' }),
  attempts: Annotation<Record<string, number>>({ reducer: (_previous, next) => next, default: () => ({}) }),
  results: Annotation<Record<string, unknown>>({ reducer: (previous, next) => ({ ...previous, ...next }), default: () => ({}) }),
  history: Annotation<RunHistoryEntry[]>({ reducer: (previous, next) => [...previous, ...next], default: () => [] }),
});

export type AgentRunStateValue = typeof AgentRunState.State;
export type AgentRunStateUpdate = typeof AgentRunState.Update;
