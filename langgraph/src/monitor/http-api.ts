import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { UnknownNoteError, type NoteArchive } from '../memory/note-archive.js';
import { DatabaseNotInstalledError, DatabaseUnavailableError } from '../store/database-settings.js';
import type { ChangeFeed } from './change-feed.js';
import { evalsReportOf } from './evals-report.js';
import { flowMapOf } from './flow-map.js';
import { moveSkillToTrash, SkillNotRemovableError } from './skill-removal.js';
import type { Database } from '../store/database.js';
import type { MonitorQueries, Page } from './monitor-queries.js';

export interface MonitorParts {
  readonly database: Database;
  readonly queries: MonitorQueries;
  readonly archive: NoteArchive;
  readonly feed: ChangeFeed;
  readonly refreshLimits: () => Promise<void>;
}

type Answer = (url: URL) => Promise<unknown>;

const ALLOWED_ORIGINS = new Set([
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
  'http://localhost:4711',
  'http://127.0.0.1:4711',
]);
const LARGEST_PAGE = 200;
const FORGET_PLAN = '/api/plans/forget';
const REMOVE_SKILL = '/api/skills/remove';
const REFRESH_LIMITS = '/api/limits/refresh';
const NOT_ALLOWED = 405;
const FORBIDDEN = 403;
const DEFAULT_PAGE = 50;
const DEFAULT_DAYS = 14;
const NOT_FOUND = 404;
const UNAVAILABLE = 503;

export function createMonitorApi({ database, queries, archive, feed, refreshLimits }: MonitorParts): Server {
  const answers: Readonly<Record<string, Answer>> = {
    '/api/prompts': (url) => queries.prompts(pageOf(url)),
    '/api/prompt': (url) => queries.prompt(url.searchParams.get('id') ?? ''),
    '/api/limits': () => queries.limits(),
    '/api/telemetry': (url) => queries.telemetry(numberOf(url, 'days', DEFAULT_DAYS)),
    '/api/stories': (url) => queries.stories(pageOf(url)),
    '/api/runs': (url) => queries.runs(url.searchParams.get('agent') ?? '', pageOf(url)),
    '/api/errors': (url) => queries.errors(pageOf(url)),
    '/api/plans': (url) => archive.plans(url.searchParams.get('text') ?? ''),
    '/api/flow-map': () => flowMapOf(),
    '/api/evals': (url) => evalsReportOf(database, url.searchParams.get('agent') ?? ''),
    '/api/agents': () => queries.agentRoster(),
    '/api/agent-activity': (url) => queries.agentActivity(url.searchParams.get('agent') ?? '', pageOf(url)),
  };

  return createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    allowKnownOrigin(request, response);
    if (url.pathname === '/api/events') {
      feed.follow(response);
      return;
    }
    if (url.pathname === REMOVE_SKILL) {
      postOnly(request, response, () =>
        moveSkillToTrash(url.searchParams.get('name') ?? '', isOwnSkill).then((kept) => {
          feed.announce();
          return { removed: true, keptIn: kept };
        }),
      );
      return;
    }
    if (url.pathname === REFRESH_LIMITS) {
      postOnly(request, response, () =>
        refreshLimits().then(() => {
          feed.announce();
          return queries.limits();
        }),
      );
      return;
    }
    if (url.pathname === FORGET_PLAN) {
      postOnly(request, response, () => archive.forget(url.searchParams.get('id') ?? '').then(() => {
        feed.announce();
        return { forgotten: true };
      }));
      return;
    }
    const answer = answers[url.pathname];
    if (answer === undefined) {
      send(response, NOT_FOUND, { message: 'Nothing is served at this address.' });
      return;
    }
    answer(url).then(
      (found) => send(response, 200, found),
      (error: unknown) => send(response, statusOf(error), { message: error instanceof Error ? error.message : String(error) }),
    );
  });
}

function postOnly(request: IncomingMessage, response: ServerResponse, act: () => Promise<unknown>): void {
  if (request.method !== 'POST') {
    send(response, NOT_ALLOWED, { message: 'This change is made with POST only.' });
    return;
  }
  act().then(
    (done) => send(response, 200, done),
    (error: unknown) => send(response, statusOfChange(error), { message: messageOf(error) }),
  );
}

function statusOfChange(error: unknown): number {
  if (error instanceof UnknownNoteError) {
    return NOT_FOUND;
  }
  return error instanceof SkillNotRemovableError ? FORBIDDEN : statusOf(error);
}

async function isOwnSkill(name: string): Promise<boolean> {
  return (await flowMapOf()).skills.some((skill) => skill.name === name && skill.origin === 'mine');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function allowKnownOrigin(request: IncomingMessage, response: ServerResponse): void {
  const origin = request.headers.origin ?? '';
  if (ALLOWED_ORIGINS.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

function statusOf(error: unknown): number {
  return error instanceof DatabaseUnavailableError || error instanceof DatabaseNotInstalledError ? UNAVAILABLE : 500;
}

function pageOf(url: URL): Page {
  return { limit: Math.min(numberOf(url, 'limit', DEFAULT_PAGE), LARGEST_PAGE), offset: numberOf(url, 'offset', 0) };
}

function numberOf(url: URL, name: string, fallback: number): number {
  const value = Number(url.searchParams.get(name) ?? fallback);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}
