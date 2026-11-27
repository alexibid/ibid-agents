import type { Fingerprint } from '../checks/workspace-changes.js';
import { stepQueue, type Plan } from '../domain/plan.js';
import { inCanonicalOrder, type StepName } from '../domain/steps.js';
import { isTestSupportFile } from '../domain/test-files.js';
import { conditionsOfFiles } from '../domain/triggers.js';
import { storyChangesSince, type ChangeScope } from './commit-staleness.js';

export async function replanFromChanges(
  plan: Plan,
  since: Fingerprint,
  scope: ChangeScope,
): Promise<{ queue: StepName[]; plan: Plan }> {
  const changedFiles = await storyChangesSince(since, scope);
  const changed = changedFiles.map(({ file }) => file);
  const conditions = conditionsOfFiles([...plan.files, ...changed], scope.sheet);
  const files = [...new Set([...plan.files, ...changed.filter((file) => !isTestSupportFile(file))])];
  return { queue: inCanonicalOrder(stepQueue(scope.sheet, conditions)), plan: { ...plan, files, conditions } };
}

export async function collectAuthoredTestFiles(
  baseline: Fingerprint,
  plannedFiles: readonly string[],
  scope: ChangeScope,
): Promise<string[]> {
  const planned = new Set(plannedFiles);
  const changedFiles = await storyChangesSince(baseline, scope);
  return changedFiles.map(({ file }) => file).filter((file) => isTestSupportFile(file) && !planned.has(file));
}
