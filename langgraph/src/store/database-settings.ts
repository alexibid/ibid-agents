import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export interface DatabaseSettings {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly database: string;
  readonly password: string;
}

export const DATABASE_DIRECTORY = resolve(import.meta.dirname, '..', '..', '..', 'database');
export const SCHEMA_FILE = join(DATABASE_DIRECTORY, 'schema.sql');

const SETTINGS_FILE = join(DATABASE_DIRECTORY, '.env');
const START_HINT = 'Run "node database/start.mjs" in ibid-agents, with Docker running.';

export class DatabaseNotInstalledError extends Error {
  constructor() {
    super(`The database has no settings yet. ${START_HINT}`);
    this.name = 'DatabaseNotInstalledError';
  }
}

export class DatabaseUnavailableError extends Error {
  constructor() {
    super(`The database cannot be reached. ${START_HINT}`);
    this.name = 'DatabaseUnavailableError';
  }
}

export async function readDatabaseSettings(): Promise<DatabaseSettings> {
  const text = await readFile(SETTINGS_FILE, 'utf8').catch(() => {
    throw new DatabaseNotInstalledError();
  });
  return settingsFrom(text);
}

export function settingsFrom(environmentText: string): DatabaseSettings {
  const entries = new Map(environmentText.split('\n').flatMap(entryOf));
  const password = entries.get('POSTGRES_PASSWORD');
  const port = Number(entries.get('IBID_DATABASE_PORT'));
  if (password === undefined || password === '' || !Number.isInteger(port)) {
    throw new DatabaseNotInstalledError();
  }
  return { host: '127.0.0.1', port, user: 'ibid', database: 'ibid_agents', password };
}

function entryOf(line: string): [string, string][] {
  const separator = line.indexOf('=');
  return separator < 1 || line.trimStart().startsWith('#')
    ? []
    : [[line.slice(0, separator).trim(), line.slice(separator + 1).trim()]];
}
