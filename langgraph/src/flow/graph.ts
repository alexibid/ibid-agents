import { END, START, StateGraph, interrupt, type BaseCheckpointSaver } from '@langchain/langgraph';
import { z } from 'zod';
import { checkRules } from '../checks/rule-checks.js';
import { runCommand } from '../checks/shell.js';
import { WorkspaceChanges, type ChangedFile } from '../checks/workspace-changes.js';
import { conditionsOfFiles, judgePlan, stepQueue, type Plan } from '../domain/plan.js';
import { CONDITIONS, STEP_ORDER, inCanonicalOrder, kindOf, repairStepFor, type StepName } from '../domain/steps.js';
import type { SheetReader } from '../sheets/sheet-reader.js';
import { failed, judgeEvidence, passed, type StepResult } from './evidence.js';
import { verifyHandover } from './final-verification.js';
import { planInstruction, stepInstruction } from './instructions.js';
import { FlowState, type FlowStateUpdate, type FlowStateValue } from './state.js';

const MAX_ATTEMPTS = 3;
const JOURNEY_PLACEHOLDER = '<journey>';
const WORKSPACE_FILE = /(?:^|\/)(?:nx\.json|project\.json|package\.json|tsconfig[^/]*\.json)$/;
const SYNC_CHECK = 'npx nx sync:check';

const submittedPlan = z.object({
  files: z.array(z.string()),
  conditions: z.array(z.enum(CONDITIONS)),
  journey: z.string().default(''),
  reusedParts: z.array(z.string()).default([]),
  brief: z.string().default(''),
});

export interface FlowDependencies {
  readonly workspaceRoot: string;
  readonly sheets: SheetReader;
  readonly contractsDirectory: string;
}

export function buildFlowGraph({ workspaceRoot, sheets, contractsDirectory }: FlowDependencies, checkpointer?: BaseCheckpointSaver) {
  const changes = new WorkspaceChanges(workspaceRoot);

  async function intakeNode(state: FlowStateValue): Promise<FlowStateUpdate> {
    return {
      sheet: await sheets.read(state.story.project),
      baseline: await changes.fingerprint(),
      contractsDirectory,
    };
  }

  async function planNode(state: FlowStateValue): Promise<FlowStateUpdate> {
    const parsed = submittedPlan.safeParse(interrupt(planInstruction(state)));
    if (!parsed.success) {
      return rejectedPlan(parsed.error.issues.map((issue) => `Plan field "${issue.path.join('.')}": ${issue.message}`));
    }
    const plan: Plan = parsed.data;
    const verdict = judgePlan(plan, state.sheet);
    if (!verdict.accepted) {
      return rejectedPlan(verdict.problems);
    }
    return {
      plan,
      queue: stepQueue(state.sheet, plan.conditions),
      position: 0,
      status: 'working',
      history: [{ step: 'plan', passed: true, details: [] }],
    };
  }

  async function stepNode(state: FlowStateValue): Promise<FlowStateUpdate> {
    const step = state.queue[state.position];
    if (step === undefined) {
      return { status: 'finished' };
    }
    const result = await performStep(step, state);
    return result.passed ? advanced(step, result, state) : sentBack(step, result, state);
  }

  async function performStep(step: StepName, state: FlowStateValue): Promise<StepResult> {
    if (kindOf(step) === 'command') {
      return runSheetCommand(step, state);
    }
    const changedFiles = await changes.changedSince(state.baseline);
    if (kindOf(step) === 'rule-checks') {
      return runRuleChecks(changedFiles);
    }
    const evidence: unknown = interrupt(stepInstruction(step, state));
    if (step === 'final-verification') {
      return verifyHandover(evidence, changedFiles, workspaceRoot);
    }
    return judgeEvidence(step, evidence, { story: state.story, plan: state.plan, changedFiles, workspaceRoot });
  }

  async function runSheetCommand(step: StepName, state: FlowStateValue): Promise<StepResult> {
    const command = state.sheet.commands[step]?.replace(JOURNEY_PLACEHOLDER, state.plan.journey);
    if (command === undefined) {
      return failed([`The sheet gives no command for "${step}".`]);
    }
    const outcome = await runCommand(command, workspaceRoot);
    return outcome.succeeded ? passed() : failed([`${command} failed:`, outcome.outputTail]);
  }

  async function runRuleChecks(changedFiles: readonly ChangedFile[]): Promise<StepResult> {
    const files = changedFiles.map(({ file }) => file);
    const violations = await checkRules(files, workspaceRoot);
    const problems = [
      ...violations.map(({ rule, file, line, message }) => `${rule} ${file}:${line} ${message}`),
      ...(await projectsOutOfSync(files)),
    ];
    return problems.length === 0 ? passed() : failed(problems);
  }

  async function projectsOutOfSync(files: readonly string[]): Promise<string[]> {
    if (!files.some((file) => WORKSPACE_FILE.test(file))) {
      return [];
    }
    const outcome = await runCommand(SYNC_CHECK, workspaceRoot);
    return outcome.succeeded ? [] : [`W06 ${SYNC_CHECK} failed:`, outcome.outputTail];
  }

  async function advanced(step: StepName, result: StepResult, state: FlowStateValue): Promise<FlowStateUpdate> {
    const queue = step === 'implement' ? await widenedQueue(state) : state.queue;
    const position = queue.indexOf(step) + 1;
    return {
      queue,
      position,
      status: position >= queue.length ? 'finished' : 'working',
      history: [{ step, passed: true, details: result.details }],
    };
  }

  async function widenedQueue(state: FlowStateValue): Promise<StepName[]> {
    const changedFiles = await changes.changedSince(state.baseline);
    const conditions = conditionsOfFiles(changedFiles.map(({ file }) => file));
    return inCanonicalOrder([...state.queue, ...stepQueue(state.sheet, conditions)]);
  }

  function sentBack(step: StepName, result: StepResult, state: FlowStateValue): FlowStateUpdate {
    const attempts = { ...state.attempts, [step]: (state.attempts[step] ?? 0) + 1 };
    const exhausted = (attempts[step] ?? 0) >= MAX_ATTEMPTS;
    return {
      attempts,
      position: state.queue.indexOf(repairStepFor(step, state.queue)),
      status: exhausted ? 'needs-user' : 'working',
      history: [{ step, passed: false, details: result.details }],
    };
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
  return [...new Set<StepName | typeof END>([step, 'implement', ...later, END])];
}

function rejectedPlan(problems: readonly string[]): FlowStateUpdate {
  return { status: 'planning', history: [{ step: 'plan', passed: false, details: problems }] };
}

export type FlowGraph = ReturnType<typeof buildFlowGraph>;
