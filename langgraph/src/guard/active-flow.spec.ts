import { mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hasActiveFlow } from './active-flow.js';

const checkpoint = (values: Readonly<Record<string, unknown>>, ts: string) =>
  JSON.stringify({ ts, channel_values: values });

function stateFileWith(file: string, rows: readonly (readonly [string, string])[]): void {
  const database = new DatabaseSync(file);
  database.exec(
    `create table checkpoints (thread_id text, checkpoint_ns text default '', checkpoint_id text, checkpoint blob)`,
  );
  const insert = database.prepare('insert into checkpoints (thread_id, checkpoint_id, checkpoint) values (?, ?, ?)');
  rows.forEach(([threadId, value], index) => insert.run(threadId, String(index), value));
  database.close();
}

describe('hasActiveFlow', () => {
  let folder = '';

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'active-flow-'));
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it('should count a working story however long it has been idle', () => {
    const idleSince = '2020-01-01T22:00:00.000Z';
    stateFileWith(join(folder, 'stories.sqlite'), [['cover', checkpoint({ status: 'working' }, idleSince)]]);

    expect(hasActiveFlow(folder)).toBe(true);
  });

  it('should count a working agent run even when another run was written after it', () => {
    stateFileWith(join(folder, 'agent-runs.sqlite'), [
      ['devops~1', checkpoint({ status: 'working' }, '2026-11-18T14:00:00.000Z')],
      ['devops~2', checkpoint({ status: 'finished' }, '2026-11-18T14:05:00.000Z')],
    ]);

    expect(hasActiveFlow(folder)).toBe(true);
  });

  it('should not count an agent run waiting for approval', () => {
    stateFileWith(join(folder, 'agent-runs.sqlite'), [
      ['trader~1', checkpoint({ status: 'working', 'branch:to:approval': 'ok' }, '2026-11-18T14:00:00.000Z')],
    ]);

    expect(hasActiveFlow(folder)).toBe(false);
  });
});
