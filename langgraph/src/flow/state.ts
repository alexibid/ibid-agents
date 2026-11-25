import { Annotation } from '@langchain/langgraph';
import type { Fingerprint } from '../checks/workspace-changes.js';
import type { Plan, Story } from '../domain/plan.js';
import type { ProjectSheet } from '../domain/sheet.js';
import type { StepName } from '../domain/steps.js';

export type StoryStatus = 'planning' | 'working' | 'ready-for-commit' | 'finished' | 'needs-user' | 'abandoned';

export interface StoryOrigin {
  readonly issue: string;
  readonly epic: string;
}

export const NO_ORIGIN: StoryOrigin = { issue: '', epic: '' };

export interface HistoryEntry {
  readonly step: StepName | 'plan';
  readonly passed: boolean;
  readonly details: readonly string[];
}

export const EMPTY_PLAN: Plan = { files: [], conditions: [], journey: '', reusedParts: [], brief: '' };

export const FlowState = Annotation.Root({
  story: Annotation<Story>(),
  origin: Annotation<StoryOrigin>({ reducer: (_previous, next) => next, default: () => NO_ORIGIN }),
  commitRequested: Annotation<boolean>({ reducer: (_previous, next) => next, default: () => false }),
  lastPasses: Annotation<Record<string, Fingerprint>>({
    reducer: (previous, next) => ({ ...previous, ...next }),
    default: () => ({}),
  }),
  sheet: Annotation<ProjectSheet>(),
  baseline: Annotation<Fingerprint>(),
  contractsDirectory: Annotation<string>(),
  plan: Annotation<Plan>({ reducer: (_previous, next) => next, default: () => EMPTY_PLAN }),
  followUps: Annotation<string[]>({ reducer: (previous, next) => [...new Set([...previous, ...next])], default: () => [] }),
  testFiles: Annotation<string[]>({ reducer: (_previous, next) => next, default: () => [] }),
  queue: Annotation<StepName[]>({ reducer: (_previous, next) => next, default: () => [] }),
  position: Annotation<number>({ reducer: (_previous, next) => next, default: () => 0 }),
  attempts: Annotation<Record<string, number>>({ reducer: (_previous, next) => next, default: () => ({}) }),
  status: Annotation<StoryStatus>({ reducer: (_previous, next) => next, default: () => 'planning' }),
  history: Annotation<HistoryEntry[]>({
    reducer: (previous, next) => [...previous, ...next],
    default: () => [],
  }),
});

export type FlowStateValue = typeof FlowState.State;
export type FlowStateUpdate = typeof FlowState.Update;
