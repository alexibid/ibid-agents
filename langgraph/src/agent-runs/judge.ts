import { stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { FieldKind, FlowStep } from './definition.js';
import { draftsIn, parsedDraft, parsedLinks, type BacklogDraft } from '../backlog/backlog.js';
import { existsForSignedInUser } from './github-link.js';
import { failedRunProblem } from './ci-run.js';

export interface Verdict {
  readonly passed: boolean;
  readonly details: readonly string[];
}

type Earlier = Readonly<Record<string, unknown>>;
type Check = (value: unknown, earlier: Earlier) => Promise<string>;

const OK = '';
const REACHABLE_TIMEOUT_MS = 6000;
const GONE = new Set([404, 410]);

const CHECKS: Readonly<Record<FieldKind, Check>> = {
  text: async (value) => (isText(value) ? OK : 'must be a text that is not empty'),
  list: async (value) => (isList(value) ? OK : 'must be a list with at least one entry'),
  yes: async (value) => (value === true ? OK : 'must be true, and only after the user said so in their own words'),
  urls: async (value) => (isList(value) ? firstProblem(value.map(String), unreachableUrl) : 'must be a list of links'),
  'optional-urls': async (value) =>
    Array.isArray(value) ? firstProblem(value.map(String), unreachableUrl) : 'must be a list of links, empty when there is nothing to cite',
  file: async (value) => (isText(value) ? missingFile(value) : 'must be the absolute path of a file that exists'),
  files: async (value) => (isList(value) ? firstProblem(value.map(String), missingFile) : 'must be a list of absolute file paths'),
  'optional-files': async (value) =>
    Array.isArray(value) ? firstProblem(value.map(String), missingFile) : 'must be a list of absolute file paths, empty when nothing changed',
  'passing-runs': async (value) =>
    isList(value) ? firstProblem(value.map(String), (link) => failedRunProblem(link)) : 'must be a list of GitHub Actions run links',
  backlog: async (value) => parsedDraft(value).problems.join('; '),
  'published-issues': async (value, earlier) => unpublishedProblem(value, draftsIn(earlier).at(0)),
};

export async function judgeHandBack(step: FlowStep, handedBack: unknown, earlier: Earlier = {}): Promise<Verdict> {
  const given = typeof handedBack === 'object' && handedBack !== null ? (handedBack as Readonly<Record<string, unknown>>) : {};
  const problems = await Promise.all(
    Object.entries(step.fields).map(async ([field, kind]) => {
      const problem = await CHECKS[kind](given[field], earlier);
      return problem === OK ? OK : `"${field}" ${problem}.`;
    }),
  );
  const details = problems.filter((problem) => problem !== OK);
  return { passed: details.length === 0, details };
}

export function handBackShapeOf(step: FlowStep): string {
  const examples: Readonly<Record<FieldKind, unknown>> = {
    text: '<text>',
    list: ['<entry>'],
    yes: true,
    urls: ['https://<source that opens>'],
    'optional-urls': ['https://<source that opens, or none>'],
    file: '/absolute/path/of/the/file',
    files: ['/absolute/path/of/each/file'],
    'optional-files': ['/absolute/path/of/each/file, or none'],
    'passing-runs': ['https://github.com/<owner>/<name>/actions/runs/<id>'],
    backlog: {
      id: '<epic-id>',
      project: '<project>',
      items: [
        {
          key: '<S1>',
          kind: 'epic | story | task',
          title: '<text>',
          body: '<text>',
          size: 'S | M | L',
          repository: '<owner/name>',
          parent: '<key, empty for the epic>',
          issue: '<link of the issue to update, empty for a new one>',
        },
      ],
    },
    'published-issues': [{ key: '<S1>', url: 'https://github.com/<owner>/<name>/issues/<number>' }],
  };
  return JSON.stringify(Object.fromEntries(Object.entries(step.fields).map(([field, kind]) => [field, examples[kind]])));
}

async function unpublishedProblem(value: unknown, draft: BacklogDraft | undefined): Promise<string> {
  if (draft === undefined) {
    return 'cannot be judged, because no earlier step handed back a backlog';
  }
  const links = parsedLinks(value, draft);
  if (links.problems.length > 0) {
    return links.problems.join('; ');
  }
  return firstProblem(
    links.value.map((link) => link.url),
    unreachableUrl,
  );
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => item !== '' && item !== null);
}

async function firstProblem(values: readonly string[], check: (value: string) => Promise<string>): Promise<string> {
  const problems = await Promise.all(values.map(check));
  return problems.find((problem) => problem !== OK) ?? OK;
}

async function missingFile(path: string): Promise<string> {
  if (!isAbsolute(path)) {
    return `has "${path}", which is not an absolute path`;
  }
  const found = await stat(path).catch(() => undefined);
  return found?.isFile() === true ? OK : `names "${path}", which does not exist`;
}

async function unreachableUrl(link: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return `has "${link}", which is not a link`;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return `has "${link}", which is not a web link`;
  }
  const response = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(REACHABLE_TIMEOUT_MS) }).catch(
    () => undefined,
  );
  if (response === undefined) {
    return `has "${link}", which could not be opened`;
  }
  if (!GONE.has(response.status) || (await existsForSignedInUser(url))) {
    return OK;
  }
  return `has "${link}", which no longer exists (${response.status})`;
}
