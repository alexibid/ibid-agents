import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export const ACTIVITY_DIRECTORY = resolve(import.meta.dirname, '..', '..', 'state', 'server-activity');

const RECORD_AT_MOST_EVERY_MS = 60_000;
const TOOL_CALL = '"tools/call"';

export function activityFileOf(directory: string, relayPid: number): string {
  return join(directory, `${relayPid}.activity`);
}

export function carriesToolCall(input: string): boolean {
  return input.includes(TOOL_CALL);
}

export class ActivityRecorder {
  private lastRecordedMs = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly file: string,
    private readonly nowMs: () => number = Date.now,
  ) {}

  async begin(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    try {
      await writeFile(this.file, new Date(this.nowMs()).toISOString(), { flag: 'wx' });
    } catch (error: unknown) {
      if (!isAlreadyThere(error)) {
        throw error;
      }
    }
  }

  async heard(): Promise<void> {
    const now = this.nowMs();
    if (now - this.lastRecordedMs < RECORD_AT_MOST_EVERY_MS) {
      return;
    }
    this.lastRecordedMs = now;
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, new Date(now).toISOString());
  }
}

function isAlreadyThere(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}

export class FileServerActivity {
  constructor(private readonly directory: string) {}

  async lastActivityOf(relayPid: number, unrecorded: Date): Promise<Date> {
    try {
      return (await stat(activityFileOf(this.directory, relayPid))).mtime;
    } catch {
      return unrecorded;
    }
  }
}
