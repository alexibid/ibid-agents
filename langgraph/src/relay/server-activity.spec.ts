import { mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ActivityRecorder, activityFileOf, carriesToolCall, FileServerActivity } from './server-activity.js';

const START_MS = Date.parse('2026-11-26T12:00:00.000Z');
const UNRECORDED = new Date('2026-11-26T13:00:00.000Z');

describe('server activity', () => {
  let folder = '';
  let nowMs = START_MS;
  const clock = () => nowMs;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'server-activity-'));
    nowMs = START_MS;
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it('should record a server the first time its engine begins, and keep an earlier record when it begins again', async () => {
    const file = activityFileOf(join(folder, 'nested'), 42);
    await new ActivityRecorder(file, clock).begin();
    nowMs += 3_600_000;
    await new ActivityRecorder(file, clock).begin();

    expect(await readFile(file, 'utf8')).toBe('2026-11-26T12:00:00.000Z');
  });

  it('should record what the client says at most once a minute', async () => {
    const file = activityFileOf(folder, 42);
    const recorder = new ActivityRecorder(file, clock);
    await recorder.heard();
    nowMs += 30_000;
    await recorder.heard();
    const withinTheMinute = await readFile(file, 'utf8');
    nowMs += 30_000;
    await recorder.heard();

    expect(withinTheMinute).toBe('2026-11-26T12:00:00.000Z');
    expect(await readFile(file, 'utf8')).toBe('2026-11-26T12:01:00.000Z');
  });

  it('should read the last activity from the record, and fall back when there is none', async () => {
    const recordedOn = new Date('2026-11-24T08:00:00.000Z');
    await writeFile(activityFileOf(folder, 7), '');
    await utimes(activityFileOf(folder, 7), recordedOn, recordedOn);
    const activity = new FileServerActivity(folder);

    expect(await activity.lastActivityOf(7, UNRECORDED)).toEqual(recordedOn);
    expect(await activity.lastActivityOf(8, UNRECORDED)).toEqual(UNRECORDED);
  });

  it('should count only tool calls as use, not the handshake a restarted engine replays', () => {
    expect(carriesToolCall('{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"story_status"}}\n')).toBe(true);
    expect(carriesToolCall('{"jsonrpc":"2.0","id":"relay-initialize","method":"initialize","params":{}}\n')).toBe(false);
    expect(carriesToolCall('{"jsonrpc":"2.0","id":4,"method":"tools/list"}\n')).toBe(false);
  });
});
