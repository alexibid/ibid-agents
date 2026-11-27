import { Annotation } from '@langchain/langgraph';

export type RunStatus = 'working' | 'finished' | 'needs-user' | 'abandoned';

export interface RunOrigin {
  readonly issue: string;
  readonly epic: string;
}

export interface RunFollowUp {
  readonly agent: string;
  readonly noApprovalAgent?: string;
  readonly issues: readonly string[];
  readonly repositories: readonly string[];
  readonly reason: string;
  readonly instruction: string;
}

export const NO_RUN_ORIGIN: RunOrigin = { issue: '', epic: '' };

export interface RunHistoryEntry {
  readonly step: string;
  readonly passed: boolean;
  readonly details: readonly string[];
}

export const AgentRunState = Annotation.Root({
  agent: Annotation<string>(),
  request: Annotation<string>(),
  origin: Annotation<RunOrigin>({ reducer: (_previous, next) => next, default: () => NO_RUN_ORIGIN }),
  linkedIssues: Annotation<string[]>({ reducer: (_previous, next) => next, default: () => [] }),
  requiredFollowUp: Annotation<RunFollowUp | undefined>({ reducer: (_previous, next) => next, default: () => undefined }),
  status: Annotation<RunStatus>({ reducer: (_previous, next) => next, default: () => 'working' }),
  attempts: Annotation<Record<string, number>>({ reducer: (_previous, next) => next, default: () => ({}) }),
  results: Annotation<Record<string, unknown>>({ reducer: (previous, next) => ({ ...previous, ...next }), default: () => ({}) }),
  history: Annotation<RunHistoryEntry[]>({ reducer: (previous, next) => [...previous, ...next], default: () => [] }),
});

export type AgentRunStateValue = typeof AgentRunState.State;
export type AgentRunStateUpdate = typeof AgentRunState.Update;
