import type { ChangedFile } from '../checks/workspace-changes.js';
import type { ProjectSheet } from '../domain/sheet.js';
import { isCommitGateStep, looksAtTheScreen, type StepName } from '../domain/steps.js';
import { isE2eFile, isStorybookFile, isTestSupportFile } from '../domain/test-files.js';
import { conditionsOfFiles } from '../domain/triggers.js';

export const SCREEN_UNCHANGED = 'Skipped: nothing that changes the screen moved since this step last passed.';
export const ONLY_TESTS_CHANGED = 'Skipped: only tests and mocks changed since the last build.';
export const TESTS_KEPT =
  'Skipped: the tests already written stay; the unit tests and the validator say when they need to change.';
export const VALIDATION_KEPT = 'Skipped: no story or test file changed since test validation last passed.';
export const REVIEW_KEPT = 'Skipped: no story file changed since review last passed.';
export const RULES_KEPT = 'Skipped: no story file changed since rule checks last passed.';
export const CHECK_UNCHANGED = 'Skipped: no relevant file changed since this check last passed.';

export interface StepChanges {
  readonly projectChanged: readonly ChangedFile[];
  readonly storyChanged: readonly ChangedFile[];
  readonly ownChanged?: readonly ChangedFile[];
  readonly sheet: ProjectSheet;
}

const MUST_RUN = '';
const RULE_CHECKED_FILE = /\.(?:ts|html|scss)$/;
const WORKSPACE_FILE = /(?:^|\/)(?:nx\.json|project\.json|package\.json|tsconfig[^/]*\.json)$/;
const LINTABLE_FILE = /\.(?:[cm]?[jt]sx?|html|s?css|json|ya?ml)$/;
const NON_TEST_ASSET = /\.(?:png|jpe?g|webp|avif|gif|ico|woff2?|ttf|eot|md)$/i;
const DOC_FILE = /\.md$/i;
const STYLE_FILE = /\.(?:s?css)$/;

export function isLintableFile(file: string): boolean {
  return LINTABLE_FILE.test(file);
}

export function isUnitTestRelevant(file: string): boolean {
  return !NON_TEST_ASSET.test(file) && !isE2eFile(file) && !isStorybookFile(file);
}

export function isValidationRelevant(file: string): boolean {
  return isUnitTestRelevant(file) && !STYLE_FILE.test(file);
}

export function isSkippableOnRepeat(step: StepName): boolean {
  return step === 'author-tests' || isCommitGateStep(step);
}

export function isStepStale(step: StepName, { projectChanged, storyChanged, ownChanged, sheet }: StepChanges): boolean {
  switch (step) {
    case 'build':
    case 'seo-audit':
      return projectChanged.some(({ file }) => isBuildRelevant(file));
    case 'lint':
      return projectChanged.some(({ file }) => isLintableFile(file));
    case 'rule-checks':
      return storyChanged.some(({ file }) => RULE_CHECKED_FILE.test(file) || WORKSPACE_FILE.test(file));
    case 'unit-tests':
      return projectChanged.some(({ file }) => isUnitTestRelevant(file));
    case 'validate-tests':
      return (ownChanged ?? storyChanged).some(({ file }) => isValidationRelevant(file));
    case 'review':
      return storyChanged.length > 0;
    case 'final-verification':
      return projectChanged.length > 0;
    case 'journey':
    case 'browser-qa':
      return projectChanged.some(({ file }) => isE2eFile(file)) || !screenUnchanged(step, projectChanged, sheet);
    case 'accessibility':
    case 'performance':
    case 'ux-critique':
    case 'visual-gate':
      return !screenUnchanged(step, projectChanged, sheet);
    default:
      return false;
  }
}

function isBuildRelevant(file: string): boolean {
  return !isTestSupportFile(file) && !isE2eFile(file) && !isStorybookFile(file) && !DOC_FILE.test(file);
}

export function skipReasonFor(step: StepName, changes: StepChanges): string {
  if (step === 'author-tests') {
    return TESTS_KEPT;
  }
  if (step === 'final-verification' || isStepStale(step, changes)) {
    return MUST_RUN;
  }
  if (step === 'build') {
    return ONLY_TESTS_CHANGED;
  }
  if (step === 'validate-tests') {
    return VALIDATION_KEPT;
  }
  if (step === 'review') {
    return REVIEW_KEPT;
  }
  if (step === 'rule-checks') {
    return RULES_KEPT;
  }
  return looksAtTheScreen(step) || step === 'journey' ? SCREEN_UNCHANGED : CHECK_UNCHANGED;
}

function screenUnchanged(step: StepName, changedSincePass: readonly ChangedFile[], sheet: ProjectSheet): boolean {
  if (changedSincePass.length === 0) {
    return true;
  }
  const conditions = sheet.mandatorySteps.filter((mandatory) => mandatory.step === step).map(({ when }) => when);
  if (conditions.includes('always')) {
    return changedSincePass.every(({ file }) => isTestSupportFile(file));
  }
  const triggered = new Set(conditionsOfFiles(changedSincePass.map(({ file }) => file), sheet));
  return !conditions.some((condition) => triggered.has(condition));
}
