import { END, START, StateGraph, interrupt, type BaseCheckpointSaver, type LangGraphRunnableConfig } from '@langchain/langgraph';
import { z } from 'zod';
import { checkRules } from '../checks/rule-checks.js';
import { runCommand } from '../checks/shell.js';
import type { ChangeTracker, ChangedFile } from '../checks/workspace-changes.js';
import { clashesWith, ownChanges, type ActiveStories } from '../domain/concurrent-stories.js';
import { judgePlan, stepQueue, type Plan } from '../domain/plan.js';
import { isOutsideWorkspace, type ProjectSheet } from '../domain/sheet.js';
import { conditionsOfFiles } from '../domain/triggers.js';
import { CONDITIONS, STEP_ORDER, inCanonicalOrder, kindOf, possibleRepairStepsFor, type StepName } from '../domain/steps.js';
import { followUpsIn } from '../domain/follow-ups.js';
import { isTestSupportFile } from '../domain/test-files.js';
import type { SheetSource } from '../sheets/sheet-reader.js';
import { failed, judgeEvidence, passed, type StepResult } from './evidence.js';
import { verifyHandover } from './final-verification.js';
import { planInstruction, stepInstruction } from './instructions.js';
import { sentBack } from './sending-back.js';
import { FlowState, type FlowStateUpdate, type FlowStateValue } from './state.js';

const JOURNEY_PLACEHOLDER = '<journey>';
const WORKSPACE_FILE = /(?:^|\/)(?:nx\.json|project\.json|package\.json|tsconfig[^/]*\.json)$/;
const SYNC_CHECK = 'npx nx sync:check';

const submittedPlan = z.object({
  files: z.array(z.string()),
  conditions: z.array(z.enum(CONDITIONS)),
  journey: z.string().default(''),
  reusedParts: z.array(z.string()).default([]),
  brief: z.string().default(''),
  followUps: z.array(z.string().min(1)).default([]),
});

interface StepOutcome {
  readonly result: StepResult;
  readonly followUps: readonly string[];
}

export interface FlowDependencies {
  readonly workspaceRoot: string;
  readonly sheets: SheetSource;
  readonly contractsDirectory: string;
  readonly changesOf: (sheet: ProjectSheet) => ChangeTracker;
  readonly activeStories: ActiveStories;
}

export function buildFlowGraph(dependencies: FlowDependencies, checkpointer?: BaseCheckpointSaver) {
  const { workspaceRoot, sheets, contractsDirectory, changesOf, activeStories } = dependencies;

  async function storyChanges(state: FlowStateValue, config: LangGraphRunnableConfig): Promise<ChangedFile[]> {
    const changed = await changesOf(state.sheet).changedSince(state.baseline);
    const ownFiles = [...state.plan.files, ...state.testFiles];
    return ownChanges(changed, ownFiles, await activeStories.changedAlongside(storyIdOf(config)));
  }

  async function intakeNode(state: FlowStateValue): Promise<FlowStateUpdate> {
    const sheet = await sheets.read(state.story.project);
    return {
      sheet,
      baseline: await changesOf(sheet).fingerprint(),
      contractsDirectory,
    };
  }

  async function planNode(state: FlowStateValue, config: LangGraphRunnableConfig): Promise<FlowStateUpdate> {
    const parsed = submittedPlan.safeParse(interrupt(planInstruction(state)));
    if (!parsed.success) {
      return rejectedPlan(parsed.error.issues.map((issue) => `Plan field "${issue.path.join('.')}": ${issue.message}`));
    }
    const { followUps, ...plan }: Plan & { followUps: string[] } = parsed.data;
    const verdict = judgePlan(plan, state.sheet);
    const clashes = clashesWith(plan.files, await activeStories.besides(storyIdOf(config)));
    if (!verdict.accepted || clashes.length > 0) {
      return rejectedPlan([...verdict.problems, ...clashes]);
    }
    return {
      plan,
      followUps,
      queue: stepQueue(state.sheet, plan.conditions),
      position: 0,
      status: 'working',
      history: [{ step: 'plan', passed: true, details: [] }],
    };
  }

  async function stepNode(state: FlowStateValue, config: LangGraphRunnableConfig): Promise<FlowStateUpdate> {
    const step = state.queue[state.position];
    if (step === undefined) {
      return { status: 'finished' };
    }
    const { result, followUps } = await performStep(step, state, config);
    return result.passed ? { ...(await advanced(step, result, state, config)), followUps: [...followUps] } : sentBack(step, result, state);
  }

  async function performStep(step: StepName, state: FlowStateValue, config: LangGraphRunnableConfig): Promise<StepOutcome> {
    if (kindOf(step) === 'command') {
      return { result: await runSheetCommand(step, state), followUps: [] };
    }
    const changedFiles = await storyChanges(state, config);
    if (kindOf(step) === 'rule-checks') {
      return { result: await runRuleChecks(changedFiles, state.sheet), followUps: [] };
    }
    const evidence: unknown = interrupt(stepInstruction(step, state));
    const result = await judgedHandBack(step, evidence, state, changedFiles);
    return { result, followUps: result.passed ? followUpsIn(step, evidence) : [] };
  }

  async function judgedHandBack(
    step: StepName,
    evidence: unknown,
    state: FlowStateValue,
    changedFiles: readonly ChangedFile[],
  ): Promise<StepResult> {
    if (step === 'final-verification') {
      return verifyHandover(evidence, changedFiles, workspaceRoot);
    }
    const { story, plan, baseline } = state;
    const dirtyAtStart = new Set(Object.keys(baseline));
    return judgeEvidence(step, evidence, { story, plan, changedFiles, dirtyAtStart, workspaceRoot });
  }

  async function runSheetCommand(step: StepName, state: FlowStateValue): Promise<StepResult> {
    const command = state.sheet.commands[step]?.replace(JOURNEY_PLACEHOLDER, state.plan.journey);
    if (command === undefined) {
      return failed([`The sheet gives no command for "${step}".`]);
    }
    const outcome = await runCommand(command, workspaceRoot);
    return outcome.succeeded ? passed() : failed([`${command} failed:`, outcome.outputTail]);
  }

  async function runRuleChecks(changedFiles: readonly ChangedFile[], sheet: ProjectSheet): Promise<StepResult> {
    const files = changedFiles.map(({ file }) => file);
    const violations = await checkRules(files, { workspaceRoot, sheet });
    const problems = [
      ...violations.map(({ rule, file, line, message }) => `${rule} ${file}:${line} ${message}`),
      ...(await projectsOutOfSync(files)),
    ];
    return problems.length === 0 ? passed() : failed(problems);
  }

  async function projectsOutOfSync(files: readonly string[]): Promise<string[]> {
    if (!files.some((file) => !isOutsideWorkspace(file) && WORKSPACE_FILE.test(file))) {
      return [];
    }
    const outcome = await runCommand(SYNC_CHECK, workspaceRoot);
    return outcome.succeeded ? [] : [`W06 ${SYNC_CHECK} failed:`, outcome.outputTail];
  }

  async function advanced(
    step: StepName,
    result: StepResult,
    state: FlowStateValue,
    config: LangGraphRunnableConfig,
  ): Promise<FlowStateUpdate> {
    const widened = step === 'implement' ? await widenedPlan(state, config) : { queue: state.queue, plan: state.plan };
    const queue = widened.queue;
    const position = queue.indexOf(step) + 1;
    return {
      ...(step === 'author-tests' ? { testFiles: await authoredTestFiles(state, config) } : {}),
      plan: widened.plan,
      queue,
      position,
      status: position >= queue.length ? 'finished' : 'working',
      history: [{ step, passed: true, details: result.details }],
    };
  }

  async function widenedPlan(state: FlowStateValue, config: LangGraphRunnableConfig): Promise<{ queue: StepName[]; plan: Plan }> {
    const changedFiles = await storyChanges(state, config);
    const found = conditionsOfFiles(changedFiles.map(({ file }) => file), state.sheet);
    const conditions = [...new Set([...state.plan.conditions, ...found])];
    return {
      queue: inCanonicalOrder([...state.queue, ...stepQueue(state.sheet, found)]),
      plan: { ...state.plan, conditions },
    };
  }

  async function authoredTestFiles(state: FlowStateValue, config: LangGraphRunnableConfig): Promise<string[]> {
    const planned = new Set(state.plan.files);
    const changedFiles = await storyChanges(state, config);
    return changedFiles.map(({ file }) => file).filter((file) => isTestSupportFile(file) && !planned.has(file));
  }

  const nextStep = (state: FlowStateValue): StepName | typeof END =>
    state.status === 'working' ? (state.queue[state.position] ?? END) : END;
  const afterPlanning = (state: FlowStateValue): StepName | 'planning' | typeof END =>
    state.status === 'planning' ? 'planning' : nextStep(state);
  const afterPlanningTargets: (StepName | 'planning' | typeof END)[] = ['planning', ...STEP_ORDER, END];

  return new StateGraph(FlowState)
    .addNode('intake', intakeNode)
    .addNode('planning', planNode)
    .addNode('author-tests', stepNode)
    .addNode('implement', stepNode)
    .addNode('build', stepNode)
    .addNode('lint', stepNode)
    .addNode('rule-checks', stepNode)
    .addNode('unit-tests', stepNode)
    .addNode('validate-tests', stepNode)
    .addNode('journey', stepNode)
    .addNode('browser-qa', stepNode)
    .addNode('accessibility', stepNode)
    .addNode('performance', stepNode)
    .addNode('ux-critique', stepNode)
    .addNode('visual-gate', stepNode)
    .addNode('review', stepNode)
    .addNode('final-verification', stepNode)
    .addEdge(START, 'intake')
    .addEdge('intake', 'planning')
    .addConditionalEdges('planning', afterPlanning, afterPlanningTargets)
    .addConditionalEdges('author-tests', nextStep, reachableFrom('author-tests'))
    .addConditionalEdges('implement', nextStep, reachableFrom('implement'))
    .addConditionalEdges('build', nextStep, reachableFrom('build'))
    .addConditionalEdges('lint', nextStep, reachableFrom('lint'))
    .addConditionalEdges('rule-checks', nextStep, reachableFrom('rule-checks'))
    .addConditionalEdges('unit-tests', nextStep, reachableFrom('unit-tests'))
    .addConditionalEdges('validate-tests', nextStep, reachableFrom('validate-tests'))
    .addConditionalEdges('journey', nextStep, reachableFrom('journey'))
    .addConditionalEdges('browser-qa', nextStep, reachableFrom('browser-qa'))
    .addConditionalEdges('accessibility', nextStep, reachableFrom('accessibility'))
    .addConditionalEdges('performance', nextStep, reachableFrom('performance'))
    .addConditionalEdges('ux-critique', nextStep, reachableFrom('ux-critique'))
    .addConditionalEdges('visual-gate', nextStep, reachableFrom('visual-gate'))
    .addConditionalEdges('review', nextStep, reachableFrom('review'))
    .addConditionalEdges('final-verification', nextStep, reachableFrom('final-verification'))
    .compile(checkpointer === undefined ? {} : { checkpointer });
}

function reachableFrom(step: StepName): (StepName | typeof END)[] {
  const later = STEP_ORDER.slice(STEP_ORDER.indexOf(step) + 1);
  return [...new Set<StepName | typeof END>([...possibleRepairStepsFor(step), ...later, END])];
}

function storyIdOf(config: LangGraphRunnableConfig): string {
  const threadId: unknown = config.configurable?.['thread_id'];
  return typeof threadId === 'string' ? threadId : '';
}

function rejectedPlan(problems: readonly string[]): FlowStateUpdate {
  return { status: 'planning', history: [{ step: 'plan', passed: false, details: problems }] };
}

export type FlowGraph = ReturnType<typeof buildFlowGraph>;
