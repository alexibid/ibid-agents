import { mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CheckpointActiveStories } from './checkpoint-active-stories.js';

const checkpoint = (status: string, files: readonly string[], ts: string) =>
  JSON.stringify({ ts, channel_values: { status, plan: { files } } });

describe('CheckpointActiveStories', () => {
  let folder = '';
  let stateFile = '';

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'active-stories-'));
    stateFile = join(folder, 'stories.sqlite');
    const database = new DatabaseSync(stateFile);
    database.exec(`create table checkpoints (thread_id text, checkpoint_ns text default '', checkpoint_id text, checkpoint blob)`);
    const insert = database.prepare('insert into checkpoints (thread_id, checkpoint_id, checkpoint) values (?, ?, ?)');
    insert.run('done-before', '1', checkpoint('finished', ['d.ts'], '2026-11-18T21:00:00.000Z'));
    insert.run('cover', '1', checkpoint('planning', [], '2026-11-18T22:00:00.000Z'));
    insert.run('encoding', '1', checkpoint('working', ['b.ts'], '2026-11-18T22:37:00.000Z'));
    insert.run('done', '1', checkpoint('finished', ['c.ts'], '2026-11-19T09:00:00.000Z'));
    insert.run('cover', '2', checkpoint('working', ['a.ts'], '2026-11-19T10:10:00.000Z'));
    database.close();
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it('should keep the focus of an unfinished story however long it has been idle', async () => {
    expect(await new CheckpointActiveStories(stateFile).besides('cover')).toEqual([
      { storyId: 'encoding', files: ['b.ts'] },
    ]);
  });

  it('should still credit the files of a story that finished after this one began', async () => {
    expect(await new CheckpointActiveStories(stateFile).changedAlongside('cover')).toEqual([
      { storyId: 'done', files: ['c.ts'] },
      { storyId: 'encoding', files: ['b.ts'] },
    ]);
  });
});
