import { join } from 'node:path';
import type { Story } from '../domain/plan.js';
import { ownerOf, type StepName } from '../domain/steps.js';
import type { HistoryEntry, FlowStateValue } from './state.js';

export interface Instruction {
  readonly waitingFor: 'plan' | 'step';
  readonly step: StepName | 'plan';
  readonly doneBy: string;
  readonly task: string;
  readonly handBack: string;
  readonly contracts: readonly string[];
  readonly coreRules: string;
  readonly projectRules: string;
  readonly story: Story;
  readonly brief: string;
  readonly lastResult: HistoryEntry | 'none';
}

const TASKS: Readonly<Partial<Record<StepName, string>>> = {
  'author-tests': 'Write a failing test for every acceptance criterion, working from the story and never from the implementation.',
  implement: 'Make the change the plan describes, inside the planned files only. If the last result failed, fix exactly what it reports.',
  'validate-tests': 'Confirm that each acceptance criterion is proven by a test that would fail without the change.',
  'browser-qa': 'Open the running app, exercise the story as a user would, and capture a screenshot of each state.',
  performance: 'Record a performance trace of the changed screens and report dropped frames and layout shifts.',
  'ux-critique': 'Use the changed screens critically. Report each problem with its severity and a screenshot. Write no code.',
  'visual-gate': 'Render the figure, inspect every detail against the reference art, and judge each part separately.',
  review: 'Read the diff against the judgement rules of the rule table and the project sheet. Mark a finding blocking when a rule is broken.',
  'final-verification': 'Prepare one Conventional Commit line per changed repository, plus the workspace root when a submodule changed.',
};

const HAND_BACK: Readonly<Partial<Record<StepName, string>>> = {
  'author-tests': '{ "specFiles": ["<workspace path>.spec.ts"] }',
  implement: '{ "summary": "<what changed>" }',
  'validate-tests': '{ "criteria": [{ "criterion": "<exact criterion text>", "test": "<test name>", "proven": true }] }',
  'browser-qa': '{ "verdict": "pass" | "fail", "findings": ["..."], "screenshots": ["<path>"] }',
  performance: '{ "verdict": "pass" | "fail", "findings": ["..."] }',
  'ux-critique': '{ "findings": [{ "severity": "high" | "medium" | "low", "description": "...", "screenshot": "<path>" }], "screenshots": ["<path>"] }',
  'visual-gate': '{ "images": ["<path>"], "details": [{ "part": "<part of the figure>", "verdict": "pass" | "fail" }] }',
  review: '{ "findings": [{ "rule": "<rule id>", "file": "<path>", "description": "...", "blocking": true }] }',
  'final-verification': '{ "commitLines": [{ "repository": "<submodule path or .>", "line": "type(scope): subject" }] }',
};

const CONTRACTS: Readonly<Partial<Record<StepName, readonly string[]>>> = {
  'author-tests': ['test-author.md'],
  implement: ['developer.md'],
  'validate-tests': ['test-validator.md'],
  'browser-qa': ['browser-qa.md'],
  performance: ['accessibility-performance.md'],
  'ux-critique': ['ux-critic.md'],
  'visual-gate': ['visual-gate.md'],
  review: ['reviewer.md'],
  'final-verification': ['final-verifier.md'],
};

const UI_CONTRACT = 'ui.md';
const NX_CONTRACT = 'nx.md';
const WORKSPACE_FILE = /(?:^|\/)(?:nx\.json|project\.json|package\.json|tsconfig[^/]*\.json|eslint\.config\.mjs)$|^tools\//;
const SPECIALIST_CONTRACT = 'specialist.md';

const PLAN_TASK =
  'Read the story and the project sheet, then plan the change: every file to create or change, the conditions the change triggers, the journey that covers it, the ibid-ui parts considered for reuse, and a brief for the steps that follow.';

const PLAN_HAND_BACK =
  '{ "files": ["<workspace path>"], "conditions": ["ui" | "figures" | "workflows"], "journey": "<NN-feature or empty>", "reusedParts": ["<ibid-ui part>"], "brief": "<contracts, signatures, layers, edge cases>" }';

export function planInstruction(state: FlowStateValue): Instruction {
  return {
    ...sharedFields(state),
    waitingFor: 'plan',
    step: 'plan',
    doneBy: `${state.story.project} specialist`,
    task: PLAN_TASK,
    handBack: PLAN_HAND_BACK,
    contracts: contractPaths([SPECIALIST_CONTRACT, NX_CONTRACT], state),
  };
}

export function stepInstruction(step: StepName, state: FlowStateValue): Instruction {
  return {
    ...sharedFields(state),
    waitingFor: 'step',
    step,
    doneBy: ownerOf(step),
    task: TASKS[step] ?? '',
    handBack: HAND_BACK[step] ?? '',
    contracts: contractPaths(contractsOf(step, state), state),
  };
}

function sharedFields(state: FlowStateValue) {
  return {
    coreRules: join(state.contractsDirectory, '..', 'rules', 'core.md'),
    projectRules: state.sheet.sheetFile,
    story: state.story,
    brief: state.plan.brief,
    lastResult: state.history.at(-1) ?? ('none' as const),
  };
}

function contractsOf(step: StepName, state: FlowStateValue): readonly string[] {
  const contracts = CONTRACTS[step] ?? [];
  if (step !== 'implement') {
    return contracts;
  }
  const touchesInterface = state.plan.conditions.includes('ui');
  const touchesWorkspace = state.plan.files.some((file) => WORKSPACE_FILE.test(file));
  return [...contracts, ...(touchesInterface ? [UI_CONTRACT] : []), ...(touchesWorkspace ? [NX_CONTRACT] : [])];
}

function contractPaths(files: readonly string[], state: FlowStateValue): string[] {
  return files.map((file) => join(state.contractsDirectory, file));
}

export interface StepDescription {
  readonly doneBy: string;
  readonly task: string;
  readonly contracts: readonly string[];
  readonly contractsWhenNeeded: readonly string[];
}

const RUN_BY_LANGGRAPH = 'LangGraph runs the command the project sheet names for this step and judges its result itself.';

export function describedStep(step: StepName | 'plan'): StepDescription {
  if (step === 'plan') {
    return { doneBy: 'project specialist', task: PLAN_TASK, contracts: [SPECIALIST_CONTRACT, NX_CONTRACT], contractsWhenNeeded: [] };
  }
  return {
    doneBy: ownerOf(step),
    task: TASKS[step] ?? RUN_BY_LANGGRAPH,
    contracts: CONTRACTS[step] ?? [],
    contractsWhenNeeded: step === 'implement' ? [UI_CONTRACT, NX_CONTRACT] : [],
  };
}
