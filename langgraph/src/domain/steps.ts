export const STEP_ORDER = [
  'author-tests',
  'implement',
  'build',
  'lint',
  'rule-checks',
  'unit-tests',
  'validate-tests',
  'journey',
  'browser-qa',
  'accessibility',
  'performance',
  'ux-critique',
  'visual-gate',
  'review',
  'final-verification',
] as const;

export type StepName = (typeof STEP_ORDER)[number];

export const CONDITIONS = ['always', 'ui', 'figures', 'workflows'] as const;

export type Condition = (typeof CONDITIONS)[number];

export type StepKind = 'command' | 'rule-checks' | 'evidence';

const COMMAND_STEPS: ReadonlySet<StepName> = new Set(['build', 'lint', 'unit-tests', 'journey', 'accessibility']);

const STEP_OWNERS: Readonly<Record<StepName, string>> = {
  'author-tests': 'test author',
  implement: 'developer or UI agent',
  build: 'flow engine',
  lint: 'flow engine',
  'rule-checks': 'flow engine',
  'unit-tests': 'flow engine',
  'validate-tests': 'test validator',
  journey: 'flow engine',
  'browser-qa': 'browser QA',
  accessibility: 'flow engine',
  performance: 'accessibility and performance agent',
  'ux-critique': 'UX critic',
  'visual-gate': 'visual gate',
  review: 'reviewer',
  'final-verification': 'final verifier',
};

const REPAIR_STEP: StepName = 'implement';

const SELF_REPAIRING_STEPS: ReadonlySet<StepName> = new Set(['author-tests', 'implement', 'final-verification']);

export function isStepName(value: string): value is StepName {
  return STEP_ORDER.some((step) => step === value);
}

export function isCondition(value: string): value is Condition {
  return CONDITIONS.some((condition) => condition === value);
}

export function kindOf(step: StepName): StepKind {
  if (COMMAND_STEPS.has(step)) {
    return 'command';
  }
  return step === 'rule-checks' ? 'rule-checks' : 'evidence';
}

export function ownerOf(step: StepName): string {
  return STEP_OWNERS[step];
}

const REPAIRED_BY: Readonly<Partial<Record<StepName, StepName>>> = { 'validate-tests': 'author-tests' };

export function possibleRepairStepsFor(failedStep: StepName): StepName[] {
  return [failedStep, ...repairersOf(failedStep)];
}

function repairersOf(failedStep: StepName): StepName[] {
  const repairer = REPAIRED_BY[failedStep];
  return repairer === undefined ? [REPAIR_STEP] : [repairer, REPAIR_STEP];
}

export function repairStepFor(failedStep: StepName, queue: readonly StepName[]): StepName {
  if (SELF_REPAIRING_STEPS.has(failedStep)) {
    return failedStep;
  }
  return repairersOf(failedStep).find((repairer) => queue.includes(repairer)) ?? failedStep;
}

export function inCanonicalOrder(steps: Iterable<StepName>): StepName[] {
  const wanted = new Set(steps);
  return STEP_ORDER.filter((step) => wanted.has(step));
}
