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
  build: 'langgraph',
  lint: 'langgraph',
  'rule-checks': 'langgraph',
  'unit-tests': 'langgraph',
  'validate-tests': 'test validator',
  journey: 'langgraph',
  'browser-qa': 'browser QA',
  accessibility: 'langgraph',
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

export function repairStepFor(failedStep: StepName, queue: readonly StepName[]): StepName {
  if (SELF_REPAIRING_STEPS.has(failedStep) || !queue.includes(REPAIR_STEP)) {
    return failedStep;
  }
  return REPAIR_STEP;
}

export function inCanonicalOrder(steps: Iterable<StepName>): StepName[] {
  const wanted = new Set(steps);
  return STEP_ORDER.filter((step) => wanted.has(step));
}
