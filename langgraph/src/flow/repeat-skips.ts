import type { ChangedFile } from '../checks/workspace-changes.js';
import type { ProjectSheet } from '../domain/sheet.js';
import { looksAtTheScreen, type StepName } from '../domain/steps.js';
import { isTestSupportFile } from '../domain/test-files.js';
import { conditionsOfFiles } from '../domain/triggers.js';

export const SCREEN_UNCHANGED = 'Skipped: nothing that changes the screen moved since this step last passed.';
export const ONLY_TESTS_CHANGED = 'Skipped: only tests and mocks changed since the last build.';
export const TESTS_KEPT =
  'Skipped: the tests already written stay; the unit tests and the validator say when they need to change.';


const MUST_RUN = '';

export function isSkippableOnRepeat(step: StepName): boolean {
  return step === 'build' || step === 'author-tests' || looksAtTheScreen(step);
}

export function skipReasonFor(step: StepName, changedSincePass: readonly ChangedFile[], sheet: ProjectSheet): string {
  if (step === 'author-tests') {
    return TESTS_KEPT;
  }
  if (step === 'build') {
    return changedSincePass.every(({ file }) => isTestSupportFile(file)) ? ONLY_TESTS_CHANGED : MUST_RUN;
  }
  return looksAtTheScreen(step) && screenUnchanged(step, changedSincePass, sheet) ? SCREEN_UNCHANGED : MUST_RUN;
}

function screenUnchanged(step: StepName, changedSincePass: readonly ChangedFile[], sheet: ProjectSheet): boolean {
  const conditions = sheet.mandatorySteps.filter((mandatory) => mandatory.step === step).map(({ when }) => when);
  if (conditions.includes('always')) {
    return false;
  }
  const triggered = new Set(conditionsOfFiles(changedSincePass.map(({ file }) => file), sheet));
  return !conditions.some((condition) => triggered.has(condition));
}
