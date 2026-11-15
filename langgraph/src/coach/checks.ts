import { access, readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { z } from 'zod';
import { runCommand } from '../checks/shell.js';
import { WorkspaceChanges, type Fingerprint } from '../checks/workspace-changes.js';
import type { CoachDesign, LessonBlock, LessonBlockPhase } from './state.js';

export interface CoachCheckResult {
  readonly passed: boolean;
  readonly details: readonly string[];
}

export interface StudentAction {
  readonly action: 'verify-student-code' | 'next-lesson-step' | 'complete';
  readonly studentFiles: readonly string[];
  readonly verifyBuild: boolean;
  readonly notes: string;
}

interface PatternRule {
  readonly label: string;
  readonly pattern: RegExp;
  readonly message: string;
}

const MAX_SNIPPET_LINES = 45;
const ALLOWED_SRC_PATH = /^src\//;
const FORBIDDEN_STAGE_PATH = /^projects\//;
const SCAFFOLD_COMMAND = /^npx\s+ng\s+(?:generate|g)\s+[a-zA-Z0-9_@/:.\s-]+$/;
const UPFRONT_IMPORT = /^\s*import\s+/m;
const DECLARATION_PHASES: ReadonlySet<LessonBlockPhase> = new Set(['component-declarations', 'directive-declarations']);

const ANGULAR_22_RULES: readonly PatternRule[] = [
  {
    label: 'no-constructor-inject',
    pattern: /constructor\s*\([^)]*\binject\s*\(/s,
    message: 'Never use inject() as a default parameter in constructor(). Initialize directly on class properties.',
  },
  {
    label: 'no-constructor-body-inject',
    pattern: /constructor\s*\([^)]*\)\s*\{[^}]*\binject\s*\(/s,
    message: 'Never assign inject() inside a constructor body. Initialize directly on class properties.',
  },
  {
    label: 'no-manual-subscription',
    pattern: /\bSubscription\b|\bimplements\b[^{]*\bOnDestroy\b|\bngOnDestroy\s*\(/,
    message: 'Do not use Subscription, implements OnDestroy, or ngOnDestroy(). Use takeUntilDestroyed(this.destroyRef).',
  },
  {
    label: 'no-legacy-rxjs-subject',
    pattern: /\b(?:BehaviorSubject|ReplaySubject)\b|\bnew\s+Subject\b/,
    message: 'Use Angular Signals (signal, computed, toSignal) instead of BehaviorSubject or Subject.',
  },
  {
    label: 'no-async-pipe',
    pattern: /\|\s*async\b/,
    message: 'Do not use the async pipe in templates. Bind directly to Signals.',
  },
  {
    label: 'no-legacy-control-flow',
    pattern: /\*ngIf\b|\*ngFor\b/,
    message: 'Use modern @if / @for control flow instead of *ngIf or *ngFor.',
  },
  {
    label: 'no-loose-index-signature',
    pattern: /\{\s*\[[a-zA-Z_]\w*\s*:\s*string\s*\]\s*:/,
    message: 'Avoid loose index signatures ({ [key: string]: ... }); type explicit keys to satisfy TS4111.',
  },
];

const designSchema = z.object({
  inspectedFiles: z.array(z.string()).min(1),
  templateProblem: z.string().min(1),
  conceptualTemplate: z.string().min(1),
  scaffoldCommands: z.array(z.string()).default([]),
});

const blockSchema = z.object({
  phase: z.enum(['component-declarations', 'directive-declarations', 'template-html', 'progressive-logic']),
  targetFile: z.string().min(1),
  problemAndThought: z.string().min(1),
  codeSnippet: z.string().min(1),
  symbolRoles: z.array(z.string()).default([]),
  explanation: z.string().min(1),
});

const lessonSchema = z.object({
  blocks: z.array(blockSchema).min(1),
});

const studentSchema = z.object({
  action: z.enum(['verify-student-code', 'next-lesson-step', 'complete']),
  studentFiles: z.array(z.string()).default([]),
  verifyBuild: z.boolean().default(false),
  notes: z.string().default(''),
});

export function ok(details: readonly string[] = []): CoachCheckResult {
  return { passed: true, details };
}

export function fail(details: readonly string[]): CoachCheckResult {
  return { passed: false, details };
}

export async function validateDesign(
  raw: unknown,
  workspaceRoot: string,
  baseline: Fingerprint,
): Promise<{ readonly result: CoachCheckResult; readonly design?: CoachDesign }> {
  const parsed = designSchema.safeParse(raw);
  if (!parsed.success) {
    return { result: fail(formatZod(parsed.error)) };
  }
  const design: CoachDesign = parsed.data;
  const problems = [
    ...(await untouchedSourceFiles(workspaceRoot, baseline)),
    ...design.inspectedFiles.flatMap((file) => checkSrcPath(file)),
    ...(await missingFiles(design.inspectedFiles, workspaceRoot)),
    ...checkScaffoldCommands(design.scaffoldCommands),
    ...checkRulesInText(design.conceptualTemplate, 'conceptualTemplate'),
  ];
  return problems.length === 0 ? { result: ok(), design } : { result: fail(problems) };
}

export async function validateLesson(
  raw: unknown,
  workspaceRoot: string,
  baseline: Fingerprint,
): Promise<{ readonly result: CoachCheckResult; readonly blocks?: readonly LessonBlock[] }> {
  const parsed = lessonSchema.safeParse(raw);
  if (!parsed.success) {
    return { result: fail(formatZod(parsed.error)) };
  }
  const { blocks } = parsed.data;
  const problems = [
    ...(await untouchedSourceFiles(workspaceRoot, baseline)),
    ...checkDeclarationFirstOrder(blocks),
    ...blocks.flatMap((block, index) => checkBlock(block, index)),
  ];
  return problems.length === 0 ? { result: ok(), blocks } : { result: fail(problems) };
}

export async function validateStudentAction(
  raw: unknown,
  workspaceRoot: string,
  baseline: Fingerprint,
): Promise<{ readonly result: CoachCheckResult; readonly action?: StudentAction }> {
  const parsed = studentSchema.safeParse(raw);
  if (!parsed.success) {
    return { result: fail(formatZod(parsed.error)) };
  }
  const studentAction: StudentAction = parsed.data;
  if (studentAction.action === 'next-lesson-step') {
    return { result: ok(['Moving to the next progressive lesson step.']), action: studentAction };
  }
  const files = await resolveStudentFiles(studentAction.studentFiles, workspaceRoot, baseline);
  const pathProblems = files.flatMap((file) => checkSrcPath(file));
  const codeProblems = await checkStudentFiles(files, workspaceRoot);
  const buildProblems = await maybeRunBuild(studentAction, workspaceRoot);
  const problems = [...pathProblems, ...codeProblems, ...buildProblems];
  return problems.length === 0 ? { result: ok(), action: studentAction } : { result: fail(problems) };
}

async function untouchedSourceFiles(workspaceRoot: string, baseline: Fingerprint): Promise<string[]> {
  const changed = await new WorkspaceChanges(workspaceRoot).changedSince(baseline);
  return changed
    .map(({ file }) => file)
    .filter((file) => ALLOWED_SRC_PATH.test(file))
    .map((file) => `Coach must never edit src/ directly: ${file} was modified.`);
}

function checkSrcPath(file: string): string[] {
  const normalized = normalize(file);
  if (normalized.startsWith('..') || normalized.startsWith('/')) {
    return [`Path must be workspace-relative inside src/: ${file}`];
  }
  if (FORBIDDEN_STAGE_PATH.test(normalized)) {
    return [`Focus strictly on src/, never stage projects: ${file}`];
  }
  return ALLOWED_SRC_PATH.test(normalized) ? [] : [`Path must live under src/: ${file}`];
}

async function missingFiles(files: readonly string[], workspaceRoot: string): Promise<string[]> {
  const checks = await Promise.all(
    files.map(async (file) =>
      access(join(workspaceRoot, file)).then(
        () => '',
        () => `Inspected file not found: ${file}`,
      ),
    ),
  );
  return checks.filter((entry) => entry !== '');
}

function checkScaffoldCommands(commands: readonly string[]): string[] {
  return commands.flatMap((command) =>
    SCAFFOLD_COMMAND.test(command.trim())
      ? []
      : [`Scaffold commands must use Angular CLI ("npx ng generate ..."): ${command}`],
  );
}

function checkDeclarationFirstOrder(blocks: readonly LessonBlock[]): string[] {
  let seenTemplate = false;
  const problems: string[] = [];
  for (const [index, block] of blocks.entries()) {
    if (block.phase === 'template-html') {
      seenTemplate = true;
    } else if (seenTemplate && DECLARATION_PHASES.has(block.phase)) {
      problems.push(
        `Block ${index + 1} (${block.phase}) appears after a template-html block; declarations must precede template bindings.`,
      );
    }
  }
  return problems;
}

function checkBlock(block: LessonBlock, index: number): string[] {
  const label = `Block ${index + 1} (${block.targetFile})`;
  const lines = block.codeSnippet.split('\n').length;
  return [
    ...checkSrcPath(block.targetFile),
    ...(lines > MAX_SNIPPET_LINES
      ? [`${label}: snippet has ${lines} lines; break it into smaller bite-sized blocks (max ${MAX_SNIPPET_LINES}).`]
      : []),
    ...(UPFRONT_IMPORT.test(block.codeSnippet)
      ? [`${label}: do not include upfront import statements; explain symbol roles inline instead.`]
      : []),
    ...checkRulesInText(block.codeSnippet, label),
  ];
}

function checkRulesInText(text: string, label: string): string[] {
  return ANGULAR_22_RULES.flatMap((rule) =>
    rule.pattern.test(text) ? [`${label} [${rule.label}]: ${rule.message}`] : [],
  );
}

async function resolveStudentFiles(
  explicitFiles: readonly string[],
  workspaceRoot: string,
  baseline: Fingerprint,
): Promise<string[]> {
  if (explicitFiles.length > 0) {
    return [...explicitFiles];
  }
  const changed = await new WorkspaceChanges(workspaceRoot).changedSince(baseline);
  return changed.map(({ file }) => file).filter((file) => /\.(?:ts|html)$/.test(file));
}

async function checkStudentFiles(files: readonly string[], workspaceRoot: string): Promise<string[]> {
  const perFile = await Promise.all(
    files.map(async (file) => {
      const content = await readFile(join(workspaceRoot, file), 'utf8').catch(() => '');
      return content === '' ? [`Cannot read student file: ${file}`] : checkRulesInText(content, file);
    }),
  );
  return perFile.flat();
}

async function maybeRunBuild(studentAction: StudentAction, workspaceRoot: string): Promise<string[]> {
  const shouldBuild = studentAction.verifyBuild || studentAction.action === 'complete';
  if (!shouldBuild) {
    return [];
  }
  const outcome = await runCommand('npm run build', workspaceRoot);
  return outcome.succeeded ? [] : ['npm run build failed:', outcome.outputTail];
}

function formatZod(error: z.ZodError): string[] {
  return error.issues.map((issue) => `Field "${issue.path.join('.')}": ${issue.message}`);
}
