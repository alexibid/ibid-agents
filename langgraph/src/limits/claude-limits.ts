import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { readClaudeUsage } from './claude-usage.js';
import { samplesOfClaudeStatusLine, type LimitSample } from './limit-sample.js';

const LAST_STATUS_LINE = join(resolve(import.meta.dirname, '..', '..'), 'state', 'claude-status-line.json');
const FRESH_FOR_MS = 10 * 60_000;

export async function keepClaudeStatusLine(rawStatusLine: string): Promise<void> {
  await mkdir(dirname(LAST_STATUS_LINE), { recursive: true });
  await writeFile(LAST_STATUS_LINE, rawStatusLine);
}

export async function readClaudeLimits(): Promise<LimitSample[]> {
  const fromUsage = await readClaudeUsage();
  return fromUsage.length > 0 ? fromUsage : readLastStatusLine();
}

async function readLastStatusLine(): Promise<LimitSample[]> {
  const details = await stat(LAST_STATUS_LINE).catch(() => undefined);
  if (details === undefined || Date.now() - details.mtimeMs > FRESH_FOR_MS) {
    return [];
  }
  try {
    return samplesOfClaudeStatusLine(JSON.parse(await readFile(LAST_STATUS_LINE, 'utf8')));
  } catch {
    return [];
  }
}
