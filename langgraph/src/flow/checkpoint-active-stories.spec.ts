import { mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CheckpointActiveStories } from './checkpoint-active-stories.js';

const checkpoint = (status: string, files: readonly string[], ts: string, epic = '') =>
  JSON.stringify({ ts, channel_values: { status, origin: { issue: '', epic }, plan: { files } } });

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

describe('CheckpointActiveStories across epics', () => {
  const EPIC_A = 'https://github.com/demo/site/issues/78';
  const EPIC_B = 'https://github.com/demo/site/issues/99';
  let folder = '';
  let stateFile = '';

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'active-epics-'));
    stateFile = join(folder, 'stories.sqlite');
    const database = new DatabaseSync(stateFile);
    database.exec(`create table checkpoints (thread_id text, checkpoint_ns text default '', checkpoint_id text, checkpoint blob)`);
    const insert = database.prepare('insert into checkpoints (thread_id, checkpoint_id, checkpoint) values (?, ?, ?)');
    insert.run('same-ready', '1', checkpoint('ready-for-commit', ['shared.scss'], '2026-11-18T21:00:00.000Z', EPIC_A));
    insert.run('same-working', '1', checkpoint('working', ['busy.ts'], '2026-11-18T21:10:00.000Z', EPIC_A));
    insert.run('same-needs-user', '1', checkpoint('needs-user', ['paused.ts'], '2026-11-18T21:15:00.000Z', EPIC_A));
    insert.run('other-ready', '1', checkpoint('ready-for-commit', ['other.ts'], '2026-11-18T21:20:00.000Z', EPIC_B));
    insert.run('loose-ready', '1', checkpoint('ready-for-commit', ['loose.ts'], '2026-11-18T21:25:00.000Z', ''));
    insert.run('current', '1', checkpoint('planning', [], '2026-11-18T22:00:00.000Z', EPIC_A));
    database.close();
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it('should exclude earlier ready-for-commit stories regardless of epic while keeping active stories', async () => {
    const active = new CheckpointActiveStories(stateFile);
    const expectedIds = ['same-needs-user', 'same-working'];

    expect((await active.besides('current')).map(({ storyId }) => storyId)).toEqual(expectedIds);
    expect((await active.changedAlongside('current')).map(({ storyId }) => storyId)).toEqual(expectedIds);
  });
});

describe('CheckpointActiveStories with concurrent agent runs', () => {
  const ROOT = '/workspace';
  let folder = '';
  let stateFile = '';
  let runsFile = '';

  const runCheckpoint = (ts: string, results: Record<string, unknown>) =>
    JSON.stringify({ ts, channel_values: { status: 'finished', results } });

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'active-runs-'));
    stateFile = join(folder, 'stories.sqlite');
    runsFile = join(folder, 'agent-runs.sqlite');
    const stories = new DatabaseSync(stateFile);
    stories.exec(`create table checkpoints (thread_id text, checkpoint_ns text default '', checkpoint_id text, checkpoint blob)`);
    stories
      .prepare('insert into checkpoints (thread_id, checkpoint_id, checkpoint) values (?, ?, ?)')
      .run('story-1', '1', checkpoint('working', ['apps/site/exit.scss'], '2026-11-26T10:00:00.000Z'));
    stories.close();

    const runs = new DatabaseSync(runsFile);
    runs.exec(`create table checkpoints (thread_id text, checkpoint_ns text default '', checkpoint_id text, checkpoint blob)`);
    const insertRun = runs.prepare('insert into checkpoints (thread_id, checkpoint_id, checkpoint) values (?, ?, ?)');
    insertRun.run('quick-change~old', '1', runCheckpoint('2026-11-26T09:00:00.000Z', { change: { changedFiles: [`${ROOT}/apps/site/old.ts`] } }));
    insertRun.run(
      'quick-change~book',
      '1',
      runCheckpoint('2026-11-26T10:05:00.000Z', { change: { changedFiles: [`${ROOT}/apps/site/book.scss`] } }),
    );
    insertRun.run(
      'content-creator~ch7',
      '1',
      runCheckpoint('2026-11-26T10:06:00.000Z', {
        write: { content: `${ROOT}/apps/site/chapter.html` },
        images: { images: [`${ROOT}/apps/site/cover.webp`] },
      }),
    );
    insertRun.run(
      'solution-architect~d1',
      '1',
      runCheckpoint('2026-11-26T10:07:00.000Z', { discover: { readFiles: [`${ROOT}/apps/site/read-only.ts`] } }),
    );
    runs.close();
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it('should credit files changed by concurrent agent runs after the story began and ignore earlier runs and readFiles', async () => {
    const active = new CheckpointActiveStories(stateFile, { agentRunsFile: runsFile, workspaceRoot: ROOT });

    expect(await active.changedAlongside('story-1')).toEqual([
      { storyId: 'content-creator~ch7', files: ['apps/site/chapter.html', 'apps/site/cover.webp'] },
      { storyId: 'quick-change~book', files: ['apps/site/book.scss'] },
    ]);
  });
});
