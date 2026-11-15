import { stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { FieldKind, FlowStep } from './definition.js';

export interface Verdict {
  readonly passed: boolean;
  readonly details: readonly string[];
}

type Check = (value: unknown) => Promise<string>;

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
};

export async function judgeHandBack(step: FlowStep, handedBack: unknown): Promise<Verdict> {
  const given = typeof handedBack === 'object' && handedBack !== null ? (handedBack as Readonly<Record<string, unknown>>) : {};
  const problems = await Promise.all(
    Object.entries(step.fields).map(async ([field, kind]) => {
      const problem = await CHECKS[kind](given[field]);
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
  };
  return JSON.stringify(Object.fromEntries(Object.entries(step.fields).map(([field, kind]) => [field, examples[kind]])));
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
  return GONE.has(response.status) ? `has "${link}", which no longer exists (${response.status})` : OK;
}
