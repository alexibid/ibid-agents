import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { ChangedFile } from '../checks/workspace-changes.js';
import type { Plan, Story } from '../domain/plan.js';
import type { StepName } from '../domain/steps.js';
import { isTestSupportFile } from '../domain/test-files.js';

export interface StepResult {
  readonly passed: boolean;
  readonly malformed: boolean;
  readonly asksTheUser: boolean;
  readonly undeclaredFiles: readonly string[];
  readonly details: readonly string[];
}

export const QUESTION_LEAD = 'The agent needs a decision from the user before going on:';

export interface EvidenceContext {
  readonly story: Story;
  readonly plan: Plan;
  readonly changedFiles: readonly ChangedFile[];
  readonly dirtyAtStart: ReadonlySet<string>;
  readonly workspaceRoot: string;
}

type Judge = (evidence: unknown, context: EvidenceContext) => Promise<StepResult> | StepResult;

const verdict = z.enum(['pass', 'fail']);

const authoredTests = z.object({ specFiles: z.array(z.string()).min(1) });
const implementation = z.object({
  summary: z.string().min(1),
  extraFiles: z.array(z.object({ file: z.string().min(1), reason: z.string().trim().min(1) })).default([]),
});
const validatedTests = z.object({
  criteria: z.array(z.object({ criterion: z.string(), test: z.string().min(1), proven: z.boolean() })),
});
const observed = z.object({ verdict, findings: z.array(z.string()), screenshots: z.array(z.string()).min(1) });
const measured = z.object({ verdict, findings: z.array(z.string()) });
const critique = z.object({
  findings: z.array(z.object({ severity: z.enum(['high', 'medium', 'low']), description: z.string(), screenshot: z.string() })),
  screenshots: z.array(z.string()).min(1),
});
const inspectedFigure = z.object({
  images: z.array(z.string()).min(1),
  details: z.array(z.object({ part: z.string(), verdict })).min(1),
});
const reviewed = z.object({
  findings: z.array(z.object({ rule: z.string(), file: z.string(), description: z.string(), blocking: z.boolean() })),
});

const SPEC_FILE = /\.spec\.ts$/;
const MALFORMED_LEAD =
  'The hand-back does not have the shape the instruction asks for, so nothing was judged. Send it again:';
const UNDECLARED_SUFFIX = ' was changed but is not in the plan. Declare it in "extraFiles" with the reason, or revert it.';

const JUDGES: Readonly<Partial<Record<StepName, Judge>>> = {
  'author-tests': judgeAuthoredTests,
  implement: judgeImplementation,
  'validate-tests': judgeValidatedTests,
  'browser-qa': judgeObservation,
  performance: judgeMeasurement,
  'ux-critique': judgeCritique,
  'visual-gate': judgeFigure,
  review: judgeReview,
};

export async function judgeEvidence(step: StepName, evidence: unknown, context: EvidenceContext): Promise<StepResult> {
  const judge = JUDGES[step];
  if (judge === undefined) {
    return failed([`The step "${step}" accepts no evidence.`]);
  }
  return judge(evidence, context);
}

export function passed(details: readonly string[] = []): StepResult {
  return { passed: true, malformed: false, asksTheUser: false, undeclaredFiles: [], details };
}

export function failed(details: readonly string[]): StepResult {
  return { passed: false, malformed: false, asksTheUser: false, undeclaredFiles: [], details };
}

export function undeclaredExtraFiles(files: readonly string[]): StepResult {
  return { passed: false, malformed: false, asksTheUser: false, undeclaredFiles: files, details: files.map(notInThePlan) };
}

export function undeclaredFilesIn(details: readonly string[]): string[] {
  return details
    .filter((detail) => detail.endsWith(UNDECLARED_SUFFIX))
    .map((detail) => detail.slice(0, -UNDECLARED_SUFFIX.length));
}

export function questionsIn(evidence: unknown): readonly string[] {
  const questions = typeof evidence === 'object' && evidence !== null ? (evidence as Record<string, unknown>)['questions'] : [];
  return Array.isArray(questions) ? questions.filter((question): question is string => typeof question === 'string' && question.trim() !== '') : [];
}

export function specFilesIn(evidence: unknown): readonly string[] {
  const parsed = authoredTests.safeParse(evidence);
  return parsed.success ? parsed.data.specFiles : [];
}

export function askingTheUser(questions: readonly string[]): StepResult {
  return { passed: false, malformed: false, asksTheUser: true, undeclaredFiles: [], details: [QUESTION_LEAD, ...questions] };
}

export function malformed(error: z.ZodError): StepResult {
  const problems = error.issues.map((issue) => `Evidence field "${issue.path.join('.')}": ${issue.message}`);
  return { passed: false, malformed: true, asksTheUser: false, undeclaredFiles: [], details: [MALFORMED_LEAD, ...problems] };
}

function judgeAuthoredTests(evidence: unknown, { changedFiles, dirtyAtStart }: EvidenceContext): StepResult {
  const parsed = authoredTests.safeParse(evidence);
  if (!parsed.success) {
    return malformed(parsed.error);
  }
  const changed = new Set(changedFiles.map(({ file }) => file));
  const unchanged = parsed.data.specFiles.filter((file) => !changed.has(file));
  const problems = [
    ...parsed.data.specFiles.filter((file) => !SPEC_FILE.test(file)).map((file) => `${file} is not a spec file.`),
    ...unchanged.filter((file) => !dirtyAtStart.has(file)).map((file) => `${file} was not created or changed.`),
  ];
  return problems.length === 0 ? passed(unchanged.map(carriedOver)) : failed(problems);
}

function judgeImplementation(evidence: unknown, { plan, changedFiles, dirtyAtStart }: EvidenceContext): StepResult {
  const parsed = implementation.safeParse(evidence);
  if (!parsed.success) {
    return malformed(parsed.error);
  }
  if (changedFiles.length === 0) {
    const carried = plan.files.filter((file) => dirtyAtStart.has(file));
    return carried.length === 0 ? failed(['No file was changed.']) : passed(carried.map(carriedOver));
  }
  const planned = new Set(plan.files);
  const strays = changedFiles.map(({ file }) => file).filter((file) => !planned.has(file) && !isTestSupportFile(file));
  const reasons = new Map(parsed.data.extraFiles.map(({ file, reason }) => [file, reason]));
  const undeclared = strays.filter((file) => !reasons.has(file));
  return undeclared.length === 0
    ? passed(strays.map((file) => `${file} was added to the plan: ${reasons.get(file)}`))
    : undeclaredExtraFiles(undeclared);
}

function notInThePlan(file: string): string {
  return `${file}${UNDECLARED_SUFFIX}`;
}

function carriedOver(file: string): string {
  return `${file} is unchanged in this story; it already carried uncommitted work when the story began.`;
}

function judgeValidatedTests(evidence: unknown, { story }: EvidenceContext): StepResult {
  const parsed = validatedTests.safeParse(evidence);
  if (!parsed.success) {
    return malformed(parsed.error);
  }
  const proven = new Set(parsed.data.criteria.filter((entry) => entry.proven).map((entry) => entry.criterion));
  const reasons = new Map(parsed.data.criteria.filter((entry) => !entry.proven).map((entry) => [entry.criterion, entry.test]));
  const unproven = story.criteria.filter((criterion) => !proven.has(criterion));
  return unproven.length === 0
    ? passed()
    : failed(unproven.map((criterion) => unprovenReason(criterion, reasons.get(criterion))));
}

function unprovenReason(criterion: string, detail: string | undefined): string {
  const reason = detail?.trim() ?? '';
  return reason === '' ? `No test proves: ${criterion}` : `No test proves: ${criterion} — ${reason}`;
}

async function judgeObservation(evidence: unknown, context: EvidenceContext): Promise<StepResult> {
  const parsed = observed.safeParse(evidence);
  if (!parsed.success) {
    return malformed(parsed.error);
  }
  const missing = await missingFiles(parsed.data.screenshots, context.workspaceRoot);
  if (missing.length > 0) {
    return failed(missing);
  }
  return parsed.data.verdict === 'pass' ? passed(parsed.data.findings) : failed(parsed.data.findings);
}

function judgeMeasurement(evidence: unknown): StepResult {
  const parsed = measured.safeParse(evidence);
  if (!parsed.success) {
    return malformed(parsed.error);
  }
  return parsed.data.verdict === 'pass' ? passed(parsed.data.findings) : failed(parsed.data.findings);
}

async function judgeCritique(evidence: unknown, context: EvidenceContext): Promise<StepResult> {
  const parsed = critique.safeParse(evidence);
  if (!parsed.success) {
    return malformed(parsed.error);
  }
  const missing = await missingFiles(parsed.data.screenshots, context.workspaceRoot);
  const severe = parsed.data.findings
    .filter(({ severity }) => severity === 'high')
    .map(({ description, screenshot }) => (screenshot.trim() === '' ? description : `${description} (${screenshot.trim()})`));
  const remaining = parsed.data.findings.filter(({ severity }) => severity !== 'high').map(({ description }) => description);
  return missing.length + severe.length === 0 ? passed(remaining) : failed([...missing, ...severe]);
}

async function judgeFigure(evidence: unknown, context: EvidenceContext): Promise<StepResult> {
  const parsed = inspectedFigure.safeParse(evidence);
  if (!parsed.success) {
    return malformed(parsed.error);
  }
  const missing = await missingFiles(parsed.data.images, context.workspaceRoot);
  const rejected = parsed.data.details.filter((detail) => detail.verdict === 'fail').map(({ part }) => `Rejected detail: ${part}`);
  return missing.length + rejected.length === 0 ? passed() : failed([...missing, ...rejected]);
}

function judgeReview(evidence: unknown): StepResult {
  const parsed = reviewed.safeParse(evidence);
  if (!parsed.success) {
    return malformed(parsed.error);
  }
  const describe = (finding: z.infer<typeof reviewed>['findings'][number]): string =>
    `${finding.rule} in ${finding.file}: ${finding.description}`;
  const blocking = parsed.data.findings.filter(({ blocking: isBlocking }) => isBlocking).map(describe);
  const advisory = parsed.data.findings.filter(({ blocking: isBlocking }) => !isBlocking).map(describe);
  return blocking.length === 0 ? passed(advisory) : failed(blocking);
}

async function missingFiles(files: readonly string[], workspaceRoot: string): Promise<string[]> {
  const checks = await Promise.all(
    files.map(async (file) => {
      const exists = await access(file.startsWith('/') ? file : join(workspaceRoot, file)).then(
        () => true,
        () => false,
      );
      return exists ? [] : [`The evidence file ${file} does not exist.`];
    }),
  );
  return checks.flat();
}
