import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { githubApiPathOf } from '../agent-runs/github-link.js';
import { isObject, numberIn, objectIn, textIn } from '../usage/json-reading.js';

export interface EpicProgress {
  readonly url: string;
  readonly title: string;
  readonly done: number;
  readonly total: number;
}

export type IssueRead = (apiPath: string) => Promise<unknown>;

export class EpicUnreadableError extends Error {
  constructor(url: string) {
    super(`The epic ${url} could not be read from GitHub.`);
    this.name = 'EpicUnreadableError';
  }
}

const run = promisify(execFile);
const GH_TIMEOUT_MS = 10000;
const KEEP_FOR_MS = 60_000;

const DONE_STAGE_LABELS = new Set(['status: ready for commit', 'status: verifying', 'status: awaiting commit']);

function isDoneSubIssue(issue: unknown): boolean {
  if (!isObject(issue)) {
    return false;
  }
  if (textIn(issue, 'state').toLowerCase() === 'closed') {
    return true;
  }
  const labels = Array.isArray(issue.labels) ? issue.labels : [];
  return labels.some((label) => isObject(label) && DONE_STAGE_LABELS.has(textIn(label, 'name')));
}

export function progressFrom(url: string, issue: unknown, subIssues: unknown = []): EpicProgress {
  const fields = isObject(issue) ? issue : {};
  const summary = objectIn(fields, 'sub_issues_summary');
  const totalFromSummary = numberIn(summary, 'total');
  const items = Array.isArray(subIssues) ? subIssues : [];
  if (items.length === 0) {
    return { url, title: textIn(fields, 'title'), done: numberIn(summary, 'completed'), total: totalFromSummary };
  }
  return {
    url,
    title: textIn(fields, 'title'),
    done: items.filter(isDoneSubIssue).length,
    total: Math.max(totalFromSummary, items.length),
  };
}

export class EpicProgressReader {
  private readonly kept = new Map<string, { readonly progress: EpicProgress; readonly readOn: number }>();

  constructor(
    private readonly read: IssueRead = readWithGh,
    private readonly now: () => number = Date.now,
  ) {}

  async progressOf(url: string): Promise<EpicProgress> {
    const kept = this.kept.get(url);
    if (kept !== undefined && this.now() - kept.readOn < KEEP_FOR_MS) {
      return kept.progress;
    }
    const apiPath = githubApiPathOf(new URL(url));
    if (apiPath === '') {
      throw new EpicUnreadableError(url);
    }
    const [issue, subIssues] = await Promise.all([
      this.read(apiPath).catch(() => Promise.reject(new EpicUnreadableError(url))),
      this.read(`${apiPath}/sub_issues?per_page=100`).catch(() => []),
    ]);
    const progress = progressFrom(url, issue, subIssues);
    this.kept.set(url, { progress, readOn: this.now() });
    return progress;
  }
}

async function readWithGh(apiPath: string): Promise<unknown> {
  const { stdout } = await run('gh', ['api', apiPath], { timeout: GH_TIMEOUT_MS });
  return JSON.parse(stdout);
}
