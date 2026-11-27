import { basename, join } from 'node:path';
import type { Story } from '../domain/plan.js';
import { agentsJoining, GENERIC_SPECIALIST, type TeamStep } from '../domain/project-team.js';
import { discoveryRulesFor } from '../domain/discovery.js';
import { conditionsUsedBy, isOutsideWorkspace, type ProjectSheet } from '../domain/sheet.js';
import { modelsFor, type StepModels } from '../domain/step-models.js';
import { ownerOf, type StepName } from '../domain/steps.js';
import type { HistoryEntry, FlowStateValue } from './state.js';

export interface Instruction {
  readonly waitingFor: 'plan' | 'step';
  readonly step: StepName | 'plan';
  readonly doneBy: string;
  readonly models: StepModels;
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
  'author-tests':
    'Write the fewest tests that prove each acceptance criterion by observable behaviour, component integration by default, on mocked data only. Test business risk, not lines of code. Extend the existing specs and keep every test that already proves something. When the last result failed, fix exactly what it reports.',
  implement:
    'Make the change the plan describes, in the planned files. When the change cannot work without another file, change it and declare it in "extraFiles" with the reason. If the last result failed, fix exactly what it reports.',
  'validate-tests':
    'Confirm that each acceptance criterion is proven, once and at the right layer, by a mocked test of observable behaviour that would fail without the change. Judge by business risk, never by coverage percentage. Name exactly which test is missing, wrong or noise to delete.',
  'browser-qa': 'Open the running app, exercise the story as a user would, and capture a screenshot of each state.',
  performance: 'Record a performance trace of the changed screens and report dropped frames and layout shifts.',
  'ux-critique': 'Use the changed screens critically. Report each problem with its severity and a screenshot. Write no code.',
  'visual-gate': 'Render the figure, inspect every detail against the reference art, and judge each part separately.',
  review: 'Read the diff against the judgement rules of the rule table and the project sheet. Mark a finding blocking when a rule is broken.',
  'final-verification': 'Prepare one Conventional Commit line per changed repository, plus the workspace root when a submodule changed.',
};

const HAND_BACK: Readonly<Partial<Record<StepName, string>>> = {
  'author-tests': '{ "specFiles": ["<workspace path>.spec.ts"] }',
  implement: '{ "summary": "<what changed>", "extraFiles": [{ "file": "<workspace path outside the plan>", "reason": "<why the change needs it>" }] }',
  'validate-tests': '{ "criteria": [{ "criterion": "<exact criterion text>", "test": "<test name>", "proven": true }] }',
  'browser-qa': '{ "verdict": "pass" | "fail", "findings": ["..."], "screenshots": ["<path>"] }',
  performance: '{ "verdict": "pass" | "fail", "findings": ["..."] }',
  'ux-critique': '{ "findings": [{ "severity": "high" | "medium" | "low", "description": "...", "screenshot": "<path>" }], "screenshots": ["<path>"] }',
  'visual-gate': '{ "images": ["<path>"], "details": [{ "part": "<part of the figure>", "verdict": "pass" | "fail" }] }',
  review: '{ "findings": [{ "rule": "<rule id>", "file": "<path>", "description": "...", "blocking": true }] }',
  'final-verification': '{ "commitLines": [{ "repository": "<submodule path or .>", "line": "type(scope): subject" }] }',
};

const FOLLOW_UPS =
  '"followUps": ["<optional: work outside this story worth doing later>"], "questions": ["<only when you cannot go on without a decision of the user; never guess instead>"]';

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
  'Read the story and the project sheet, then plan the change: every file to create or change, the conditions the change triggers, the journey that covers it, the parts of the libraries the sheet names under "Reuses" considered for reuse, and a brief for the steps that follow.';

export function planInstruction(state: FlowStateValue): Instruction {
  return {
    ...sharedFields(state),
    waitingFor: 'plan',
    step: 'plan',
    doneBy: specialistOf(state.sheet),
    models: modelsFor('plan'),
    task: PLAN_TASK,
    handBack: planHandBack(state.sheet),
    contracts: [
      ...projectContracts([state.sheet.specialist], state),
      ...contractPaths([SPECIALIST_CONTRACT, NX_CONTRACT], state),
      ...joiningContracts('plan', state),
      ...discoveryContracts('plan', state),
    ],
  };
}

function specialistOf(sheet: ProjectSheet): string {
  return sheet.specialist === GENERIC_SPECIALIST ? `${sheet.project} specialist` : basename(sheet.specialist, '.md');
}

function planHandBack(sheet: ProjectSheet): string {
  const conditions = [...conditionsUsedBy(sheet)].filter((condition) => condition !== 'always');
  const conditionList = conditions.length === 0 ? '' : conditions.map((condition) => `"${condition}"`).join(' | ');
  const reusedPart = sheet.reuses.length === 0 ? '' : `"<${sheet.reuses.join(' or ')} part>"`;
  return `{ "files": ["<workspace path>"], "conditions": [${conditionList}], "journey": "<NN-feature or empty>", "reusedParts": [${reusedPart}], "brief": "<contracts, signatures, layers, edge cases>", ${FOLLOW_UPS} }`;
}

export function stepInstruction(step: StepName, state: FlowStateValue, changedFiles: readonly string[] = []): Instruction {
  return {
    ...sharedFields(state),
    waitingFor: 'step',
    step,
    doneBy: ownerWithProjectAgents(step, state),
    models: modelsFor(step),
    task: step === 'validate-tests' ? validationTask(state, changedFiles) : (TASKS[step] ?? ''),
    handBack: withFollowUps(HAND_BACK[step] ?? ''),
    contracts: [
      ...contractPaths(contractsOf(step, state), state),
      ...joiningContracts(step, state),
      ...discoveryContracts(step, state),
    ],
  };
}

function validationTask(state: FlowStateValue, changedFiles: readonly string[]): string {
  const baseTask = TASKS['validate-tests'] ?? '';
  if (changedFiles.length > 0) {
    return `${baseTask} Tests already passed validation earlier; only these files changed since: ${changedFiles.join(', ')}. Re-check only the affected criteria and keep unaffected criteria marked proven.`;
  }
  const priorFailure = state.lastPasses['validate-tests'] === undefined ? priorFailedValidation(state.history) : [];
  if (priorFailure.length > 0) {
    return `${baseTask} Prior validation failed only on: ${priorFailure.join(' | ')}. Re-check those unproven criteria and keep previously proven criteria marked proven.`;
  }
  return baseTask;
}

function priorFailedValidation(history: readonly HistoryEntry[]): readonly string[] {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry === undefined || entry.step !== 'validate-tests') {
      continue;
    }
    return entry.passed ? [] : entry.details;
  }
  return [];
}

function withFollowUps(handBack: string): string {
  return handBack === '' ? '' : handBack.replace(/ }$/, `, ${FOLLOW_UPS} }`);
}

function ownerWithProjectAgents(step: StepName, state: FlowStateValue): string {
  const agents = agentsJoining(step, state.plan.conditions, state.sheet.agents).map(({ agent }) => agent);
  return agents.length === 0 ? ownerOf(step) : `${ownerOf(step)}, with ${agents.join(' and ')}`;
}

function joiningContracts(step: TeamStep, state: FlowStateValue): string[] {
  const agents = agentsJoining(step, state.plan.conditions, state.sheet.agents);
  return projectContracts(agents.map(({ contract }) => contract), state);
}

function discoveryContracts(step: TeamStep, state: FlowStateValue): string[] {
  return discoveryRulesFor(step, state.sheet).map((file) => join(state.contractsDirectory, '..', file));
}

function projectContracts(paths: readonly string[], state: FlowStateValue): string[] {
  const generic = join(state.contractsDirectory, SPECIALIST_CONTRACT);
  return paths.map((path) => join(state.contractsDirectory, '..', path)).filter((path) => path !== generic);
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
  const touchesWorkspace = state.plan.files.some((file) => !isOutsideWorkspace(file) && WORKSPACE_FILE.test(file));
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

const RUN_BY_ENGINE = 'The flow engine runs the command the project sheet names for this step and judges its result itself.';

export function describedStep(step: StepName | 'plan'): StepDescription {
  if (step === 'plan') {
    return { doneBy: 'project specialist', task: PLAN_TASK, contracts: [SPECIALIST_CONTRACT, NX_CONTRACT], contractsWhenNeeded: [] };
  }
  return {
    doneBy: ownerOf(step),
    task: TASKS[step] ?? RUN_BY_ENGINE,
    contracts: CONTRACTS[step] ?? [],
    contractsWhenNeeded: step === 'implement' ? [UI_CONTRACT, NX_CONTRACT] : [],
  };
}
