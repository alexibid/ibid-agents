import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { NoteArchive } from '../memory/note-archive.js';
import { DatabaseNotInstalledError, DatabaseUnavailableError } from '../store/database-settings.js';
import type { ChangeFeed } from './change-feed.js';
import type { MonitorQueries, Page } from './monitor-queries.js';

export interface MonitorParts {
  readonly queries: MonitorQueries;
  readonly archive: NoteArchive;
  readonly feed: ChangeFeed;
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
const DEFAULT_PAGE = 50;
const DEFAULT_DAYS = 14;
const NOT_FOUND = 404;
const UNAVAILABLE = 503;

export function createMonitorApi({ queries, archive, feed }: MonitorParts): Server {
  const answers: Readonly<Record<string, Answer>> = {
    '/api/prompts': (url) => queries.prompts(pageOf(url)),
    '/api/prompt': (url) => queries.prompt(url.searchParams.get('id') ?? ''),
    '/api/limits': () => queries.limits(),
    '/api/telemetry': (url) => queries.telemetry(numberOf(url, 'days', DEFAULT_DAYS)),
    '/api/stories': (url) => queries.stories(pageOf(url)),
    '/api/errors': (url) => queries.errors(pageOf(url)),
    '/api/notes': (url) => notesFor(archive, url.searchParams.get('text') ?? ''),
  };

  return createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    allowKnownOrigin(request, response);
    if (url.pathname === '/api/events') {
      feed.follow(response);
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

function notesFor(archive: NoteArchive, text: string): Promise<unknown> {
  return text.trim() === '' ? archive.stillOpen([]) : archive.recall({ text, projects: [] });
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
