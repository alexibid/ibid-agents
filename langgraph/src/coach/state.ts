import { Annotation } from '@langchain/langgraph';
import type { Fingerprint } from '../checks/workspace-changes.js';

export type CoachStatus = 'designing' | 'authoring-lesson' | 'awaiting-student' | 'finished';

export type CoachPhase = 'design-outside-in' | 'author-lesson' | 'await-student';

export type LessonBlockPhase =
  | 'component-declarations'
  | 'directive-declarations'
  | 'template-html'
  | 'progressive-logic';

export interface CoachGoal {
  readonly goal: string;
  readonly workspaceRoot: string;
}

export interface CoachDesign {
  readonly inspectedFiles: readonly string[];
  readonly templateProblem: string;
  readonly conceptualTemplate: string;
  readonly scaffoldCommands: readonly string[];
}

export interface LessonBlock {
  readonly phase: LessonBlockPhase;
  readonly targetFile: string;
  readonly problemAndThought: string;
  readonly codeSnippet: string;
  readonly symbolRoles: readonly string[];
  readonly explanation: string;
}

export interface CoachHistoryEntry {
  readonly step: CoachPhase;
  readonly passed: boolean;
  readonly details: readonly string[];
}

export const EMPTY_DESIGN: CoachDesign = {
  inspectedFiles: [],
  templateProblem: '',
  conceptualTemplate: '',
  scaffoldCommands: [],
};

export const CoachState = Annotation.Root({
  goal: Annotation<CoachGoal>(),
  contractsDirectory: Annotation<string>(),
  baseline: Annotation<Fingerprint>(),
  design: Annotation<CoachDesign>({ reducer: (_previous, next) => next, default: () => EMPTY_DESIGN }),
  blocks: Annotation<LessonBlock[]>({ reducer: (_previous, next) => next, default: () => [] }),
  status: Annotation<CoachStatus>({ reducer: (_previous, next) => next, default: () => 'designing' }),
  history: Annotation<CoachHistoryEntry[]>({
    reducer: (previous, next) => [...previous, ...next],
    default: () => [],
  }),
});

export type CoachStateValue = typeof CoachState.State;
export type CoachStateUpdate = typeof CoachState.Update;
