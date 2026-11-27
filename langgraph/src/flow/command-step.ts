import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { runCommand, type CommandOutcome } from '../checks/shell.js';
import type { ChangedFile } from '../checks/workspace-changes.js';
import type { StepName } from '../domain/steps.js';
import { isE2eFile, isTestSupportFile, isUnitSpecFile } from '../domain/test-files.js';
import { failed, passed, type StepResult } from './evidence.js';
import { isLintableFile, isUnitTestRelevant } from './repeat-skips.js';
import type { FlowStateValue } from './state.js';

export interface CommandStepOptions {
  readonly workspaceRoot: string;
  readonly changedSincePass?: readonly ChangedFile[];
  readonly run?: (command: string, workingDirectory: string) => Promise<CommandOutcome>;
}

const JOURNEY_PLACEHOLDER = '<journey>';
const NX_TEST_COMMAND = /^npx nx test \S+$/;
const NX_LINT_COMMAND = /^npx nx lint \S+$/;
const UNIT_TEST_EXECUTORS = new Set(['@angular/build:unit-test', '@nx/angular:unit-test']);
const ESLINT_EXECUTOR = '@nx/eslint:lint';
const LINT_TARGET_FILE = /\.(?:[cm]?[jt]sx?|html)$/;
const HTML_FILE = /\.html$/;
const WORKSPACE_CONFIG = /(?:^|\/)(?:nx\.json|project\.json|package\.json|tsconfig[^/]*\.json|eslint\.config\.[^/]+)$/;

const projectConfigSchema = z.object({
  sourceRoot: z.string().optional(),
  targets: z.record(z.string(), z.object({ executor: z.string().optional() })).optional(),
});

type ProjectConfig = z.infer<typeof projectConfigSchema>;

export async function commandStep(step: StepName, state: FlowStateValue, options: CommandStepOptions): Promise<StepResult> {
  const command = await resolveCommand(step, state, options);
  if (command === undefined) {
    return failed([`The sheet gives no command for "${step}".`]);
  }
  const execute = options.run ?? runCommand;
  const outcome = await execute(command, options.workspaceRoot);
  return outcome.succeeded ? passed() : failed([`${command} failed:`, outcome.outputTail]);
}

export async function resolveCommand(
  step: StepName,
  state: FlowStateValue,
  options: CommandStepOptions,
): Promise<string | undefined> {
  const baseCommand = state.sheet.commands[step]?.replace(JOURNEY_PLACEHOLDER, state.plan.journey);
  if (baseCommand === undefined) {
    return undefined;
  }
  if (state.lastPasses[step] === undefined || options.changedSincePass === undefined || options.changedSincePass.length === 0) {
    return baseCommand;
  }
  const project = await readProjectConfig(options.workspaceRoot, state.sheet.path);
  if (project === undefined) {
    return baseCommand;
  }
  if (step === 'unit-tests') {
    return narrowedUnitTestCommand(baseCommand, state.sheet.path, { project, options });
  }
  if (step === 'lint') {
    return narrowedLintCommand(baseCommand, project, options);
  }
  return baseCommand;
}

async function narrowedUnitTestCommand(
  baseCommand: string,
  projectPath: string,
  context: { readonly project: ProjectConfig; readonly options: CommandStepOptions },
): Promise<string> {
  const { project, options } = context;
  if (!NX_TEST_COMMAND.test(baseCommand) || !UNIT_TEST_EXECUTORS.has(project.targets?.['test']?.executor ?? '')) {
    return baseCommand;
  }
  const sourceRoot = project.sourceRoot ?? `${projectPath}/src`;
  const relevant = uniqueFiles(options.changedSincePass ?? []).filter(isUnitTestRelevant);
  if (
    relevant.length === 0 ||
    !relevant.every((file) => !/\s/.test(file) && isUnitSpecFile(file) && file.startsWith(`${sourceRoot}/`)) ||
    !(await allExist(relevant, options.workspaceRoot))
  ) {
    return baseCommand;
  }
  return `${baseCommand} ${relevant.map((file) => `--include=${file}`).join(' ')}`;
}

async function narrowedLintCommand(baseCommand: string, project: ProjectConfig, options: CommandStepOptions): Promise<string> {
  if (!NX_LINT_COMMAND.test(baseCommand) || project.targets?.['lint']?.executor !== ESLINT_EXECUTOR) {
    return baseCommand;
  }
  const lintable = uniqueFiles(options.changedSincePass ?? []).filter(isLintableFile);
  if (
    lintable.length === 0 ||
    !lintable.every((file) => !/\s/.test(file) && isLeafLintTarget(file)) ||
    !(await allExist(lintable, options.workspaceRoot))
  ) {
    return baseCommand;
  }
  return `${baseCommand} ${lintable.map((file) => `--lintFilePatterns=${file}`).join(' ')}`;
}

function isLeafLintTarget(file: string): boolean {
  return !WORKSPACE_CONFIG.test(file) && LINT_TARGET_FILE.test(file) && (isTestSupportFile(file) || isE2eFile(file) || HTML_FILE.test(file));
}

function uniqueFiles(changed: readonly ChangedFile[]): string[] {
  return [...new Set(changed.map(({ file }) => file))];
}

async function readProjectConfig(workspaceRoot: string, projectPath: string): Promise<ProjectConfig | undefined> {
  const raw = await readFile(join(workspaceRoot, projectPath, 'project.json'), 'utf8').catch(() => '');
  if (raw === '') {
    return undefined;
  }
  try {
    const parsed = projectConfigSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

async function allExist(files: readonly string[], workspaceRoot: string): Promise<boolean> {
  const checks = await Promise.all(
    files.map((file) =>
      access(join(workspaceRoot, file)).then(
        () => true,
        () => false,
      ),
    ),
  );
  return checks.every(Boolean);
}
