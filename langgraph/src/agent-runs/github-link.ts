import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);
const ISSUE_PATH = /^\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)\/?$/;
const REPOSITORY_PATH = /^\/([^/]+)\/([^/]+)\/?$/;
const GH_TIMEOUT_MS = 10000;

export type ApiCall = (path: string) => Promise<boolean>;

export class IssueNotFoundError extends Error {
  constructor(url: string) {
    super(`${url} is not a GitHub issue the signed-in user can read. A story starts from an existing issue.`);
    this.name = 'IssueNotFoundError';
  }
}

export function githubApiPathOf(url: URL): string {
  if (!GITHUB_HOSTS.has(url.hostname)) {
    return '';
  }
  const issue = ISSUE_PATH.exec(url.pathname);
  if (issue !== null) {
    return `repos/${issue[1]}/${issue[2]}/issues/${issue[3]}`;
  }
  const repository = REPOSITORY_PATH.exec(url.pathname);
  return repository === null ? '' : `repos/${repository[1]}/${repository[2]}`;
}

export async function existsForSignedInUser(url: URL, call: ApiCall = callGh): Promise<boolean> {
  const path = githubApiPathOf(url);
  return path === '' ? false : call(path);
}

export async function verifyGithubIssues(urls: readonly string[], call: ApiCall = callGh): Promise<void> {
  for (const url of urls.filter((link) => link !== '')) {
    if (!(await existsForSignedInUser(new URL(url), call))) {
      throw new IssueNotFoundError(url);
    }
  }
}

async function callGh(path: string): Promise<boolean> {
  return run('gh', ['api', path, '--silent'], { timeout: GH_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);
}
