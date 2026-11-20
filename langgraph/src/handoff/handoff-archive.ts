import type { Database, Row, Value } from '../store/database.js';
import type {
  ActiveBaton,
  ActiveRunSummary,
  ActiveStorySummary,
  Handoff,
  HandoffClient,
  HandoffStatus,
  NewHandoff,
} from './handoff.js';

export interface QueryableDatabase {
  rows<Shape extends Row>(text: string, values?: readonly Value[]): Promise<Shape[]>;
}

export interface HandoffArchive {
  save(handoff: NewHandoff): Promise<Handoff>;
  active(workspace: string): Promise<ActiveBaton>;
  close(handoffId: string): Promise<Handoff>;
}

interface HandoffRow extends Row {
  readonly id: string;
  readonly workspace: string;
  readonly client: HandoffClient;
  readonly topic: string;
  readonly summary: string;
  readonly decisions: readonly string[];
  readonly next_action: string;
  readonly open_questions: readonly string[];
  readonly active_story_id: string;
  readonly active_run_id: string;
  readonly active_coach_id: string;
  readonly status: HandoffStatus;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface ActiveStoryRow extends Row {
  readonly id: string;
  readonly project: string;
  readonly title: string;
  readonly status: string;
  readonly updated_at: Date;
}

interface ActiveRunRow extends Row {
  readonly id: string;
  readonly agent: string;
  readonly request: string;
  readonly status: string;
  readonly updated_at: Date;
}

export class UnknownHandoffError extends Error {
  constructor(handoffId: string) {
    super(`No handoff has the id "${handoffId}".`);
    this.name = 'UnknownHandoffError';
  }
}

const MAX_ACTIVE_ITEMS = 10;

const HANDOFF_COLUMNS = [
  'id, workspace, client, topic, summary, decisions, next_action, open_questions,',
  'active_story_id, active_run_id, active_coach_id, status, created_at, updated_at',
].join(' ');

const SAVE_HANDOFF = `
  insert into handoffs (
    workspace, client, topic, summary, decisions, next_action, open_questions,
    active_story_id, active_run_id, active_coach_id, status
  )
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open')
  on conflict (workspace, lower(topic)) where status = 'open' do update
    set client = excluded.client,
        summary = excluded.summary,
        decisions = excluded.decisions,
        next_action = excluded.next_action,
        open_questions = excluded.open_questions,
        active_story_id = excluded.active_story_id,
        active_run_id = excluded.active_run_id,
        active_coach_id = excluded.active_coach_id,
        updated_at = now()
  returning ${HANDOFF_COLUMNS}`;

const OPEN_HANDOFFS = `
  select ${HANDOFF_COLUMNS} from handoffs
  where status = 'open' and ($1 = '' or workspace = $1)
  order by updated_at desc
  limit ${MAX_ACTIVE_ITEMS}`;

const ACTIVE_STORIES = `
  select id, project, title, status, updated_at from stories
  where status in ('working', 'needs-user')
  order by updated_at desc
  limit ${MAX_ACTIVE_ITEMS}`;

const ACTIVE_RUNS = `
  select id, agent, request, status, updated_at from agent_runs
  where status in ('working', 'needs-user')
  order by updated_at desc
  limit ${MAX_ACTIVE_ITEMS}`;

const CLOSE_HANDOFF = `
  update handoffs set status = 'closed', updated_at = now()
  where id::text = $1
  returning ${HANDOFF_COLUMNS}`;

export class PostgresHandoffArchive implements HandoffArchive {
  constructor(private readonly database: QueryableDatabase | Database) {}

  async save(handoff: NewHandoff): Promise<Handoff> {
    const values: readonly Value[] = [
      handoff.workspace,
      handoff.client,
      handoff.topic,
      handoff.summary,
      handoff.decisions,
      handoff.nextAction,
      handoff.openQuestions,
      handoff.activeStoryId,
      handoff.activeRunId,
      handoff.activeCoachId,
    ];
    const rows = await this.database.rows<HandoffRow>(SAVE_HANDOFF, values);
    return handoffOf(rows.at(0), handoff.topic);
  }

  async active(workspace: string): Promise<ActiveBaton> {
    const [handoffRows, storyRows, runRows] = await Promise.all([
      this.database.rows<HandoffRow>(OPEN_HANDOFFS, [workspace.trim()]),
      this.database.rows<ActiveStoryRow>(ACTIVE_STORIES),
      this.database.rows<ActiveRunRow>(ACTIVE_RUNS),
    ]);
    return {
      handoffs: handoffRows.map((row) => handoffOf(row, row.id)),
      activeStories: storyRows.map(storySummaryOf),
      activeRuns: runRows.map(runSummaryOf),
    };
  }

  async close(handoffId: string): Promise<Handoff> {
    const rows = await this.database.rows<HandoffRow>(CLOSE_HANDOFF, [handoffId]);
    return handoffOf(rows.at(0), handoffId);
  }
}

function handoffOf(row: HandoffRow | undefined, reference: string): Handoff {
  if (row === undefined) {
    throw new UnknownHandoffError(reference);
  }
  return {
    id: row.id,
    workspace: row.workspace,
    client: row.client,
    topic: row.topic,
    summary: row.summary,
    decisions: row.decisions,
    nextAction: row.next_action,
    openQuestions: row.open_questions,
    activeStoryId: row.active_story_id,
    activeRunId: row.active_run_id,
    activeCoachId: row.active_coach_id,
    status: row.status,
    createdOn: row.created_at.toISOString(),
    updatedOn: row.updated_at.toISOString(),
  };
}

function storySummaryOf(row: ActiveStoryRow): ActiveStorySummary {
  return {
    id: row.id,
    project: row.project,
    title: row.title,
    status: row.status,
    updatedOn: row.updated_at.toISOString(),
  };
}

function runSummaryOf(row: ActiveRunRow): ActiveRunSummary {
  return {
    id: row.id,
    agent: row.agent,
    request: row.request,
    status: row.status,
    updatedOn: row.updated_at.toISOString(),
  };
}
