import { END, START, StateGraph, interrupt, type BaseCheckpointSaver, type LangGraphRunnableConfig } from '@langchain/langgraph';
import { z } from 'zod';
import type { ChangeTracker, ChangedFile, Fingerprint } from '../checks/workspace-changes.js';
import type { ActiveStories } from '../domain/concurrent-stories.js';
import { judgePlan, stepQueue, type Plan } from '../domain/plan.js';
import type { ProjectSheet } from '../domain/sheet.js';
import { CONDITIONS, STEP_ORDER, isCommitGateStep, kindOf, possibleRepairStepsFor, type StepName } from '../domain/steps.js';
import { followUpsIn } from '../domain/follow-ups.js';
import type { SheetSource } from '../sheets/sheet-reader.js';
import { commandStep } from './command-step.js';
import {
  changedProjectFilesSince,
  changedValidationFilesSince,
  earliestStaleCommitStep,
  sameFingerprint,
  stepChangesSince,
  storyChangesSince,
  type ChangeScope,
} from './commit-staleness.js';
import { askingTheUser, judgeEvidence, passed, questionsIn, specFilesIn, type StepResult } from './evidence.js';
import { verifyHandover } from './final-verification.js';
import { planInstruction, stepInstruction } from './instructions.js';
import { isSkippableOnRepeat, skipReasonFor, TESTS_KEPT } from './repeat-skips.js';
import { collectAuthoredTestFiles, replanFromChanges } from './replan.js';
import { ruleChecksStep } from './rule-checks-step.js';
import { seoAuditStep } from './seo-audit-step.js';
import { clearedAttempts, sentBack } from './sending-back.js';
import { FlowState, type FlowStateUpdate, type FlowStateValue, type StoryStatus } from './state.js';

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
  readonly specFiles: readonly string[];
  readonly skipped: boolean;
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

  function scopeOf(state: FlowStateValue, config: LangGraphRunnableConfig, extraOwn: readonly string[] = []): ChangeScope {
    return {
      storyId: storyIdOf(config),
      sheet: state.sheet,
      ownFiles: [...state.plan.files, ...state.testFiles, ...extraOwn],
      tracker: changesOf(state.sheet),
      activeStories,
    };
  }

  async function storyChanges(
    state: FlowStateValue,
    config: LangGraphRunnableConfig,
    options: { readonly since?: Fingerprint; readonly extraOwn?: readonly string[] } = {},
  ): Promise<ChangedFile[]> {
    return storyChangesSince(options.since ?? state.baseline, scopeOf(state, config, options.extraOwn));
  }

  async function intakeNode(state: FlowStateValue): Promise<FlowStateUpdate> {
    const sheet = await sheets.read(state.story.project);
    return {
      sheet,
      baseline: await changesOf(sheet).fingerprint(),
      contractsDirectory,
    };
  }

  async function planNode(state: FlowStateValue): Promise<FlowStateUpdate> {
    const handedBack: unknown = interrupt(planInstruction(state));
    const questions = questionsIn(handedBack);
    if (questions.length > 0) {
      return { status: 'needs-user', history: [{ step: 'plan', passed: false, details: askingTheUser(questions).details }] };
    }
    const parsed = submittedPlan.safeParse(handedBack);
    if (!parsed.success) {
      return rejectedPlan(parsed.error.issues.map((issue) => `Plan field "${issue.path.join('.')}": ${issue.message}`));
    }
    const { followUps, ...plan }: Plan & { followUps: string[] } = parsed.data;
    const verdict = judgePlan(plan, state.sheet);
    if (!verdict.accepted) {
      return rejectedPlan(verdict.problems);
    }
    const queue = stepQueue(state.sheet, plan.conditions);
    return {
      plan,
      followUps,
      queue,
      position: 0,
      implementBaseline: await changesOf(state.sheet).fingerprint(),
      status: statusBefore(queue[0], state),
      history: [{ step: 'plan', passed: true, details: [] }],
    };
  }

  async function stepNode(state: FlowStateValue, config: LangGraphRunnableConfig): Promise<FlowStateUpdate> {
    const step = state.queue[state.position];
    if (step === undefined) {
      return { status: 'finished' };
    }
    if (isCommitGateStep(step) && !state.commitRequested) {
      return { status: 'ready-for-commit' };
    }
    const outcome = await performStep(step, state, config);
    if (outcome.result.passed) {
      return { ...(await advanced(step, outcome, state, config)), followUps: [...outcome.followUps] };
    }
    const update = sentBack(step, outcome.result, state);
    const reenteringImplement = typeof update.position === 'number' && state.queue[update.position] === 'implement' && step !== 'implement';
    return reenteringImplement ? { ...update, implementBaseline: await changesOf(state.sheet).fingerprint() } : update;
  }

  async function performStep(step: StepName, state: FlowStateValue, config: LangGraphRunnableConfig): Promise<StepOutcome> {
    const skipped = await skipReason(step, state, config);
    if (skipped !== '') {
      return { result: passed([skipped]), followUps: [], specFiles: [], skipped: true };
    }
    if (kindOf(step) === 'command') {
      const changedSincePass = await changedProjectFilesSince(state.lastPasses[step], scopeOf(state, config));
      const options = { workspaceRoot, ...(changedSincePass !== undefined ? { changedSincePass } : {}) };
      return { result: await commandStep(step, state, options), followUps: [], specFiles: [], skipped: false };
    }
    const since = step === 'implement' ? (state.implementBaseline ?? state.baseline) : state.baseline;
    const changedFiles = await storyChanges(state, config, { since });
    if (kindOf(step) === 'rule-checks') {
      return { result: await ruleChecksStep(changedFiles, workspaceRoot, state.sheet), followUps: [], specFiles: [], skipped: false };
    }
    if (kindOf(step) === 'seo-audit') {
      return { ...(await seoAuditStep(changedFiles, { workspaceRoot, sheet: state.sheet })), specFiles: [], skipped: false };
    }
    const changedValidation = step === 'validate-tests' ? await changedValidationFilesSince(state.lastPasses[step], scopeOf(state, config)) : [];
    const evidence: unknown = interrupt(stepInstruction(step, state, changedValidation));
    const questions = questionsIn(evidence);
    if (questions.length > 0) {
      return { result: askingTheUser(questions), followUps: [], specFiles: [], skipped: false };
    }
    const specFiles = step === 'author-tests' ? specFilesIn(evidence) : [];
    const ownChanged = specFiles.length > 0 ? await storyChanges(state, config, { extraOwn: specFiles }) : changedFiles;
    const result = await judgedHandBack(step, evidence, state, ownChanged);
    return { result, followUps: result.passed ? followUpsIn(step, evidence) : [], specFiles, skipped: false };
  }

  async function skipReason(step: StepName, state: FlowStateValue, config: LangGraphRunnableConfig): Promise<string> {
    const lastPass = state.lastPasses[step];
    if (lastPass === undefined || sentStraightHere(step, state)) {
      return '';
    }
    if (step === 'author-tests') {
      return TESTS_KEPT;
    }
    const scope = scopeOf(state, config);
    if (sameFingerprint(await scope.tracker.fingerprint(), lastPass)) {
      return skipReasonFor(step, { projectChanged: [], storyChanged: [], sheet: state.sheet });
    }
    return skipReasonFor(step, await stepChangesSince(lastPass, scope));
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
    const { story, plan, baseline, implementBaseline, history } = state;
    const initialImplement = step === 'implement' && !history.some((entry) => entry.step === 'implement' && entry.passed);
    const dirtyAtStart = new Set(Object.keys(initialImplement ? (implementBaseline ?? baseline) : baseline));
    return judgeEvidence(step, evidence, { story, plan, changedFiles, dirtyAtStart, workspaceRoot });
  }

  async function advanced(step: StepName, outcome: StepOutcome, state: FlowStateValue, config: LangGraphRunnableConfig): Promise<FlowStateUpdate> {
    const replanned =
      step === 'implement'
        ? await replanFromChanges(state.plan, state.implementBaseline ?? state.baseline, scopeOf(state, config))
        : { queue: state.queue, plan: state.plan };
    const queue = replanned.queue;
    const nextPosition = queue.indexOf(step) + 1;
    const currentFp = await changesOf(state.sheet).fingerprint();
    const recordPass = isSkippableOnRepeat(step) && !outcome.skipped;
    const updatedPasses = recordPass ? { ...state.lastPasses, [step]: currentFp } : state.lastPasses;
    const stale =
      state.commitRequested && isCommitGateStep(step)
        ? await earliestStaleCommitStep({
            queue,
            position: nextPosition,
            lastPasses: updatedPasses,
            currentFingerprint: currentFp,
            scope: scopeOf(state, config, replanned.plan.files),
          })
        : undefined;
    const position = stale ?? nextPosition;
    return {
      ...(step === 'author-tests'
        ? { testFiles: await collectAuthoredTestFiles(state.baseline, state.plan.files, scopeOf(state, config, outcome.specFiles)) }
        : {}),
      ...(recordPass ? { lastPasses: { [step]: currentFp } } : {}),
      attempts: clearedAttempts(step, state.attempts),
      plan: replanned.plan,
      queue,
      position,
      status: position >= queue.length ? 'finished' : statusBefore(queue[position], state),
      history: [{ step, passed: true, details: outcome.result.details }],
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
    .addNode('implement', stepNode)
    .addNode('author-tests', stepNode)
    .addNode('build', stepNode)
    .addNode('lint', stepNode)
    .addNode('rule-checks', stepNode)
    .addNode('seo-audit', stepNode)
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
    .addConditionalEdges('implement', nextStep, reachableFrom('implement'))
    .addConditionalEdges('author-tests', nextStep, reachableFrom('author-tests'))
    .addConditionalEdges('build', nextStep, reachableFrom('build'))
    .addConditionalEdges('lint', nextStep, reachableFrom('lint'))
    .addConditionalEdges('rule-checks', nextStep, reachableFrom('rule-checks'))
    .addConditionalEdges('seo-audit', nextStep, reachableFrom('seo-audit'))
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
  const commitGates = isCommitGateStep(step) ? STEP_ORDER.filter(isCommitGateStep) : [];
  return [...new Set<StepName | typeof END>([...possibleRepairStepsFor(step), ...commitGates, ...later, END])];
}

function storyIdOf(config: LangGraphRunnableConfig): string {
  const threadId: unknown = config.configurable?.['thread_id'];
  return typeof threadId === 'string' ? threadId : '';
}

function sentStraightHere(step: StepName, state: FlowStateValue): boolean {
  const last = state.history.at(-1);
  return last !== undefined && !last.passed && last.step !== 'implement' && step === 'author-tests';
}

function statusBefore(next: StepName | undefined, state: FlowStateValue): StoryStatus {
  return next !== undefined && isCommitGateStep(next) && !state.commitRequested ? 'ready-for-commit' : 'working';
}

function rejectedPlan(problems: readonly string[]): FlowStateUpdate {
  return { status: 'planning', history: [{ step: 'plan', passed: false, details: problems }] };
}

export type FlowGraph = ReturnType<typeof buildFlowGraph>;
