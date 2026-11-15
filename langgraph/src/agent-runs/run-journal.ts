import type { Database } from '../store/database.js';
import { DatabaseNotInstalledError, DatabaseUnavailableError } from '../store/database-settings.js';
import type { RunHistoryEntry, RunStatus } from './state.js';

export interface RunJournal {
  started(run: { readonly runId: string; readonly agent: string; readonly request: string }): Promise<boolean>;
  judged(run: { readonly runId: string; readonly status: RunStatus; readonly entries: readonly RunHistoryEntry[] }): Promise<boolean>;
}

export const NOT_RECORDING_RUNS: RunJournal = { started: async () => false, judged: async () => false };

const START = `
  insert into agent_runs (id, agent, request, status) values ($1, $2, $3, 'working')
  on conflict (id) do nothing`;

const EVENT = `
  insert into agent_run_events (run_id, step, passed, details, attempt, seconds_taken)
  select $1, $2, $3, $4,
    (select count(*) + 1 from agent_run_events where run_id = $1 and step = $2),
    extract(epoch from now() - updated_at)
  from agent_runs where id = $1`;

const TOUCH = 'update agent_runs set status = $2, updated_at = now() where id = $1';

export class PostgresRunJournal implements RunJournal {
  constructor(private readonly database: Database) {}

  started({ runId, agent, request }: { readonly runId: string; readonly agent: string; readonly request: string }): Promise<boolean> {
    return this.#write(() => this.database.inOneTransaction([{ text: START, values: [runId, agent, request] }]));
  }

  judged({ runId, status, entries }: { readonly runId: string; readonly status: RunStatus; readonly entries: readonly RunHistoryEntry[] }): Promise<boolean> {
    const events = entries.map((entry) => ({ text: EVENT, values: [runId, entry.step, entry.passed, entry.details] }));
    return this.#write(() => this.database.inOneTransaction([...events, { text: TOUCH, values: [runId, status] }]));
  }

  async #write(write: () => Promise<void>): Promise<boolean> {
    try {
      await write();
      return true;
    } catch (error) {
      if (error instanceof DatabaseUnavailableError || error instanceof DatabaseNotInstalledError) {
        return false;
      }
      throw error;
    }
  }
}
