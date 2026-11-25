import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isObject, numberIn, textIn } from '../usage/json-reading.js';
import type { IssueState } from './board.js';

export type IssueList = (repository: string) => Promise<unknown>;

const run = promisify(execFile);
const GH_TIMEOUT_MS = 15000;
const KEEP_FOR_MS = 60_000;
const LIMIT = '500';

export class IssueStateReader {
  private readonly kept = new Map<string, { readonly states: Map<string, IssueState>; readonly readOn: number }>();

  constructor(
    private readonly list: IssueList = listWithGh,
    private readonly now: () => number = Date.now,
  ) {}

  async statesOf(repositories: readonly string[]): Promise<Map<string, IssueState>> {
    const perRepository = await Promise.all([...new Set(repositories)].map((repository) => this.statesIn(repository)));
    return new Map(perRepository.flatMap((states) => [...states]));
  }

  private async statesIn(repository: string): Promise<Map<string, IssueState>> {
    const kept = this.kept.get(repository);
    if (kept !== undefined && this.now() - kept.readOn < KEEP_FOR_MS) {
      return kept.states;
    }
    const states = statesFrom(repository, await this.list(repository).catch(() => []));
    this.kept.set(repository, { states, readOn: this.now() });
    return states;
  }
}

export function statesFrom(repository: string, listed: unknown): Map<string, IssueState> {
  const issues = Array.isArray(listed) ? listed.filter(isObject) : [];
  return new Map(
    issues.map((issue) => [
      `https://github.com/${repository}/issues/${numberIn(issue, 'number')}`,
      { state: textIn(issue, 'state').toLowerCase() === 'closed' ? 'closed' : 'open', labels: labelNamesOf(issue['labels']) },
    ]),
  );
}

function labelNamesOf(labels: unknown): string[] {
  return (Array.isArray(labels) ? labels : []).filter(isObject).map((label) => textIn(label, 'name'));
}

async function listWithGh(repository: string): Promise<unknown> {
  const { stdout } = await run(
    'gh',
    ['issue', 'list', '-R', repository, '--state', 'all', '--limit', LIMIT, '--json', 'number,state,labels'],
    { timeout: GH_TIMEOUT_MS },
  );
  return JSON.parse(stdout);
}
