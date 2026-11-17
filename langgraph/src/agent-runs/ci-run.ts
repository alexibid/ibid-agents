import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const RUN_PATH = /^\/([^/]+)\/([^/]+)\/actions\/runs\/(\d+)(?:\/.*)?$/;
const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);
const GH_TIMEOUT_MS = 10000;
const OK = '';

export type ConclusionLookup = (apiPath: string) => Promise<string>;

export function runApiPathOf(link: string): string {
  const url = URL.canParse(link) ? new URL(link) : undefined;
  if (url === undefined || !GITHUB_HOSTS.has(url.hostname)) {
    return '';
  }
  const match = RUN_PATH.exec(url.pathname);
  return match === null ? '' : `repos/${match[1]}/${match[2]}/actions/runs/${match[3]}`;
}

export async function failedRunProblem(link: string, lookUp: ConclusionLookup = conclusionFromGh): Promise<string> {
  const apiPath = runApiPathOf(link);
  if (apiPath === '') {
    return `has "${link}", which is not the link of a GitHub Actions run`;
  }
  const conclusion = await lookUp(apiPath);
  return conclusion === 'success' ? OK : `has "${link}", whose run ended as "${conclusion || 'unknown'}", not "success"`;
}

async function conclusionFromGh(apiPath: string): Promise<string> {
  return run('gh', ['api', apiPath, '--jq', '.conclusion // "in progress"'], { timeout: GH_TIMEOUT_MS })
    .then(({ stdout }) => stdout.trim())
    .catch(() => '');
}
