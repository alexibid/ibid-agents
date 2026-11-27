import { checkRules } from '../checks/rule-checks.js';
import { runCommand } from '../checks/shell.js';
import type { ChangedFile } from '../checks/workspace-changes.js';
import { isOutsideWorkspace, type ProjectSheet } from '../domain/sheet.js';
import { failed, passed, type StepResult } from './evidence.js';

const WORKSPACE_FILE = /(?:^|\/)(?:nx\.json|project\.json|package\.json|tsconfig[^/]*\.json)$/;
const SYNC_CHECK = 'npx nx sync:check';

export async function ruleChecksStep(
  changedFiles: readonly ChangedFile[],
  workspaceRoot: string,
  sheet: ProjectSheet,
): Promise<StepResult> {
  const files = changedFiles.map(({ file }) => file);
  const violations = await checkRules(files, { workspaceRoot, sheet });
  const problems = [
    ...violations.map(({ rule, file, line, message }) => `${rule} ${file}:${line} ${message}`),
    ...(await projectsOutOfSync(files, workspaceRoot)),
  ];
  return problems.length === 0 ? passed() : failed(problems);
}

async function projectsOutOfSync(files: readonly string[], workspaceRoot: string): Promise<string[]> {
  if (!files.some((file) => !isOutsideWorkspace(file) && WORKSPACE_FILE.test(file))) {
    return [];
  }
  const outcome = await runCommand(SYNC_CHECK, workspaceRoot);
  return outcome.succeeded ? [] : [`W06 ${SYNC_CHECK} failed:`, outcome.outputTail];
}
