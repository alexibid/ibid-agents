import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { DatabaseUnavailableError, readDatabaseSettings, SCHEMA_FILE } from './database-settings.js';

export type Row = Readonly<Record<string, unknown>>;
export type Value = string | number | boolean | Date | readonly string[];

export interface Statement {
  readonly text: string;
  readonly values: readonly Value[];
}

const CONNECTION_FAULTS = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', '57P03']);
const CONNECTION_TIMEOUT_MS = 3000;

export class Database {
  #pool: Promise<pg.Pool> | undefined;

  async rows<Shape extends Row>(text: string, values: readonly Value[] = []): Promise<Shape[]> {
    const pool = await this.#connected();
    const result = await pool.query<Shape>(text, [...values]).catch(rethrowAsUnavailable);
    return result.rows;
  }

  async inOneTransaction(statements: readonly Statement[]): Promise<void> {
    const pool = await this.#connected();
    const client = await pool.connect().catch(rethrowAsUnavailable);
    try {
      await client.query('begin');
      for (const statement of statements) {
        await client.query(statement.text, [...statement.values]);
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    const pool = await this.#pool?.catch(() => undefined);
    this.#pool = undefined;
    await pool?.end();
  }

  #connected(): Promise<pg.Pool> {
    this.#pool ??= open().catch((error: unknown) => {
      this.#pool = undefined;
      throw error;
    });
    return this.#pool;
  }
}

async function open(): Promise<pg.Pool> {
  const settings = await readDatabaseSettings();
  const pool = new pg.Pool({ ...settings, connectionTimeoutMillis: CONNECTION_TIMEOUT_MS, max: 4 });
  pool.on('error', () => undefined);
  try {
    await pool.query(await readFile(SCHEMA_FILE, 'utf8'));
    return pool;
  } catch (error) {
    await pool.end().catch(() => undefined);
    return rethrowAsUnavailable(error);
  }
}

function rethrowAsUnavailable(error: unknown): never {
  if (isConnectionFault(error)) {
    throw new DatabaseUnavailableError();
  }
  throw error;
}

function isConnectionFault(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  return CONNECTION_FAULTS.has(code) || /timeout|terminated|ECONNREFUSED/i.test(error.message);
}
