import type { Story } from '../domain/plan.js';
import type { HistoryEntry, StoryStatus } from '../flow/state.js';
import type { Database, Statement } from '../store/database.js';
import { DatabaseNotInstalledError, DatabaseUnavailableError } from '../store/database-settings.js';

export interface StartedStory {
  readonly storyId: string;
  readonly story: Story;
  readonly status: StoryStatus;
}

export interface JudgedSteps {
  readonly storyId: string;
  readonly status: StoryStatus;
  readonly entries: readonly HistoryEntry[];
}

export interface FlowJournal {
  storyStarted(started: StartedStory): Promise<boolean>;
  stepsJudged(judged: JudgedSteps): Promise<boolean>;
}

export const NOT_RECORDING: FlowJournal = {
  storyStarted: async () => false,
  stepsJudged: async () => false,
};

const INSERT_STORY = `
  insert into stories (id, project, title, criteria, status) values ($1, $2, $3, $4, $5)
  on conflict (id) do update set status = excluded.status, updated_at = now()`;

const INSERT_EVENT = `
  insert into step_events (story_id, step, passed, details, attempt, seconds_taken)
  select $1, $2, $3, $4,
    (select count(*) + 1 from step_events where story_id = $1 and step = $2),
    extract(epoch from now() - updated_at)
  from stories where id = $1`;

const TOUCH_STORY = 'update stories set status = $2, updated_at = now() where id = $1';

export class PostgresFlowJournal implements FlowJournal {
  constructor(private readonly database: Database) {}

  storyStarted({ storyId, story, status }: StartedStory): Promise<boolean> {
    return this.#write([{ text: INSERT_STORY, values: [storyId, story.project, story.title, story.criteria, status] }]);
  }

  stepsJudged({ storyId, status, entries }: JudgedSteps): Promise<boolean> {
    const events = entries.map((entry) => ({
      text: INSERT_EVENT,
      values: [storyId, entry.step, entry.passed, entry.details],
    }));
    return this.#write([...events, { text: TOUCH_STORY, values: [storyId, status] }]);
  }

  async #write(statements: readonly Statement[]): Promise<boolean> {
    try {
      await this.database.inOneTransaction(statements);
      return true;
    } catch (error) {
      if (error instanceof DatabaseUnavailableError || error instanceof DatabaseNotInstalledError) {
        return false;
      }
      throw error;
    }
  }
}
