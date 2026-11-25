import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export type ChannelValues = Readonly<Record<string, unknown>>;

export interface LatestThread {
  readonly threadId: string;
  readonly values: ChannelValues;
  readonly startedOn: Date;
  readonly updatedOn: Date;
}

export interface StoryThread {
  readonly storyId: string;
  readonly status: string;
  readonly issue: string;
  readonly epic: string;
  readonly files: readonly string[];
  readonly startedOn: Date;
  readonly updatedOn: Date;
}

interface CheckpointRow {
  readonly thread_id: string;
  readonly checkpoint: Uint8Array | string;
  readonly first_checkpoint: Uint8Array | string;
}

const WORKING = 'working';
const HOLDING: ReadonlySet<string> = new Set([WORKING, 'ready-for-commit', 'needs-user']);

const LATEST_PER_THREAD = `
  select latest.thread_id, latest.checkpoint, first.checkpoint as first_checkpoint
  from (
    select thread_id, max(rowid) as newest, min(rowid) as oldest
    from checkpoints where checkpoint_ns = '' group by thread_id
  ) bounds
  join checkpoints latest on latest.rowid = bounds.newest
  join checkpoints first on first.rowid = bounds.oldest`;

export function isWorking(thread: StoryThread): boolean {
  return thread.status === WORKING;
}

export function holdsItsFiles(thread: StoryThread): boolean {
  return HOLDING.has(thread.status);
}

export function latestThreads(stateFile: string): LatestThread[] {
  if (!existsSync(stateFile)) {
    return [];
  }
  const database = new DatabaseSync(stateFile, { readOnly: true });
  try {
    const rows = database.prepare(LATEST_PER_THREAD).all() as unknown as CheckpointRow[];
    return rows.map(threadOf);
  } catch {
    return [];
  } finally {
    database.close();
  }
}

export function latestStoryThreads(stateFile: string): StoryThread[] {
  return latestThreads(stateFile).map(storyThreadOf);
}

function storyThreadOf({ threadId, values, startedOn, updatedOn }: LatestThread): StoryThread {
  return {
    storyId: threadId,
    status: textOf(values['status']),
    issue: textOf(fieldOf(values['origin'], 'issue')),
    epic: textOf(fieldOf(values['origin'], 'epic')),
    files: [...textsOf(fieldOf(values['plan'], 'files')), ...textsOf(values['testFiles'])],
    startedOn,
    updatedOn,
  };
}

function threadOf(row: CheckpointRow): LatestThread {
  const latest = parsed(row.checkpoint);
  const values = fieldOf(latest, 'channel_values');
  return {
    threadId: row.thread_id,
    values: isRecord(values) ? values : {},
    startedOn: new Date(textOf(fieldOf(parsed(row.first_checkpoint), 'ts'))),
    updatedOn: new Date(textOf(fieldOf(latest, 'ts'))),
  };
}

function parsed(checkpoint: Uint8Array | string): unknown {
  return JSON.parse(typeof checkpoint === 'string' ? checkpoint : Buffer.from(checkpoint).toString('utf8'));
}

function fieldOf(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : '';
}

function isRecord(value: unknown): value is ChannelValues {
  return typeof value === 'object' && value !== null;
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function textsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}
