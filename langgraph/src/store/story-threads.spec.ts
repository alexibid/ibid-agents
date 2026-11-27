import { mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { holdsItsFiles, latestStoryThreads, type StoryThread } from './story-threads.js';

const checkpoint = (status: string, files: readonly string[], ts: string, testFiles: readonly string[] = []) =>
  JSON.stringify({ ts, channel_values: { status, plan: { files }, testFiles } });

const thread = (status: string, epic: string): StoryThread => ({
  storyId: 's1',
  status,
  issue: 'https://github.com/demo/site/issues/80',
  epic,
  files: ['a.ts'],
  startedOn: new Date('2026-11-18T22:00:00.000Z'),
  updatedOn: new Date('2026-11-18T22:10:00.000Z'),
});

describe('latestStoryThreads', () => {
  let folder = '';
  let stateFile = '';

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'story-threads-'));
    stateFile = join(folder, 'stories.sqlite');
    const database = new DatabaseSync(stateFile);
    database.exec(`create table checkpoints (thread_id text, checkpoint_ns text default '', checkpoint_id text, checkpoint blob)`);
    const insert = database.prepare('insert into checkpoints (thread_id, checkpoint_id, checkpoint) values (?, ?, ?)');
    insert.run('cover', '1', checkpoint('planning', [], '2026-11-18T22:00:00.000Z'));
    insert.run('cover', '2', checkpoint('working', ['a.ts'], '2026-11-18T22:10:00.000Z'));
    insert.run('encoding', '1', checkpoint('working', ['b.ts'], '2026-11-18T22:05:00.000Z', ['b.spec.ts', 'b.mock.ts']));
    database.close();
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it('should read the latest state of every story, not only the last one written', () => {
    expect(latestStoryThreads(stateFile).map(({ storyId, status, files }) => ({ storyId, status, files }))).toEqual([
      { storyId: 'cover', status: 'working', files: ['a.ts'] },
      { storyId: 'encoding', status: 'working', files: ['b.ts', 'b.spec.ts', 'b.mock.ts'] },
    ]);
  });

  it('should date every story from its first state to its latest', () => {
    const cover = latestStoryThreads(stateFile).find(({ storyId }) => storyId === 'cover');

    expect(cover?.startedOn.toISOString()).toBe('2026-11-18T22:00:00.000Z');
    expect(cover?.updatedOn.toISOString()).toBe('2026-11-18T22:10:00.000Z');
  });

  it('should read nothing when there is no state yet', () => {
    expect(latestStoryThreads(join(folder, 'missing.sqlite'))).toEqual([]);
  });
});

describe('holdsItsFiles', () => {
  const epic = 'https://github.com/demo/site/issues/78';

  it('should hold files while a story is actively working or waiting for the user', () => {
    expect(holdsItsFiles(thread('working', epic))).toBe(true);
    expect(holdsItsFiles(thread('needs-user', epic))).toBe(true);
  });

  it('should not hold files for ready-for-commit, planning, finished, or abandoned stories', () => {
    expect(holdsItsFiles(thread('ready-for-commit', epic))).toBe(false);
    expect(holdsItsFiles(thread('ready-for-commit', ''))).toBe(false);
    expect(holdsItsFiles(thread('planning', epic))).toBe(false);
    expect(holdsItsFiles(thread('finished', epic))).toBe(false);
    expect(holdsItsFiles(thread('abandoned', epic))).toBe(false);
  });
});
