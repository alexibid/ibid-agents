import { z } from 'zod';
import { runCommand } from '../checks/shell.js';
import type { ChangedFile } from '../checks/workspace-changes.js';
import { failed, passed, type StepResult } from './evidence.js';
import { handoverCommands } from './handover-commands.js';

const commitLines = z.object({
  commitLines: z.array(z.object({ repository: z.string().min(1), line: z.string().min(1) })).min(1),
});

const ROOT_REPOSITORY = '.';
const COMMITLINT = 'npx --no-install commitlint --config tools/commitlint/commitlint.config.js';
const SECRETLINT = 'npx --no-install secretlint --secretlintignore .secretlintignore';

export async function verifyHandover(
  evidence: unknown,
  changedFiles: readonly ChangedFile[],
  workspaceRoot: string,
): Promise<StepResult> {
  const parsed = commitLines.safeParse(evidence);
  if (!parsed.success) {
    return failed(parsed.error.issues.map((issue) => `Evidence field "${issue.path.join('.')}": ${issue.message}`));
  }
  const lines = parsed.data.commitLines;
  const problems = [
    ...repositoriesWithoutLine(lines, changedFiles),
    ...(await rejectedLines(lines, workspaceRoot)),
    ...(await leakedSecrets(changedFiles, workspaceRoot)),
  ];
  return problems.length === 0 ? passed(handoverCommands(lines, changedFiles, workspaceRoot)) : failed(problems);
}

function repositoriesWithoutLine(
  lines: readonly { readonly repository: string }[],
  changedFiles: readonly ChangedFile[],
): string[] {
  const covered = new Set(lines.map(({ repository }) => repository));
  const changed = new Set(changedFiles.map(({ repository }) => repository));
  if ([...changed].some((repository) => repository !== ROOT_REPOSITORY)) {
    changed.add(ROOT_REPOSITORY);
  }
  return [...changed].filter((repository) => !covered.has(repository)).map((repository) => `No commit line for ${repository}.`);
}

async function rejectedLines(
  lines: readonly { readonly repository: string; readonly line: string }[],
  workspaceRoot: string,
): Promise<string[]> {
  const outcomes = await Promise.all(lines.map(({ line }) => runCommand(COMMITLINT, workspaceRoot, `${line}\n`)));
  return outcomes.flatMap((outcome, index) =>
    outcome.succeeded ? [] : [`commitlint rejected "${lines[index]?.line ?? ''}":\n${outcome.outputTail}`],
  );
}

async function leakedSecrets(changedFiles: readonly ChangedFile[], workspaceRoot: string): Promise<string[]> {
  if (changedFiles.length === 0) {
    return [];
  }
  const files = changedFiles.map(({ file }) => `'${file.replaceAll("'", "'\\''")}'`).join(' ');
  const outcome = await runCommand(`${SECRETLINT} ${files}`, workspaceRoot);
  return outcome.succeeded ? [] : [`secretlint found a credential:\n${outcome.outputTail}`];
}
