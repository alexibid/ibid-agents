#!/usr/bin/env node
import { readAntigravityLimits } from './limits/antigravity-limits.js';
import { ClaudeEstimate } from './limits/claude-estimate.js';
import { readClaudeLimits } from './limits/claude-limits.js';
import { LimitLedger } from './limits/limit-ledger.js';
import { PostgresNoteArchive } from './memory/note-archive.js';
import { ChangeFeed } from './monitor/change-feed.js';
import { createMonitorApi } from './monitor/http-api.js';
import { MonitorQueries } from './monitor/monitor-queries.js';
import { Database } from './store/database.js';
import { UsageLedger } from './usage/usage-ledger.js';
import { UsageSync } from './usage/usage-sync.js';

const PORT = Number(process.env['IBID_MONITOR_PORT'] ?? 4710);
const READ_ACTIVITY_EVERY_MS = 20_000;
const SAMPLE_LIMITS_EVERY_MS = 60_000;

const database = new Database();
const feed = new ChangeFeed();
const usageSync = new UsageSync(new UsageLedger(database));
const limitLedger = new LimitLedger(database);
const claudeEstimate = new ClaudeEstimate(database);
let lastFault = '';

async function readActivity(): Promise<void> {
  await usageSync.readNewActivity();
  await limitLedger.shareOutAmongPrompts();
  feed.announce();
}

async function sampleLimits(): Promise<void> {
  const samples = (await Promise.all([readAntigravityLimits(), readClaudeLimits(), claudeEstimate.refresh()])).flat();
  if (samples.length > 0) {
    await limitLedger.keep(samples);
  }
}

function repeatedly(task: () => Promise<void>, everyMs: number): void {
  const attempt = () =>
    task().then(
      () => (lastFault = ''),
      (error: unknown) => reportOnce(error instanceof Error ? error.message : String(error)),
    );
  void attempt();
  setInterval(() => void attempt(), everyMs);
}

function reportOnce(fault: string): void {
  if (fault !== lastFault) {
    console.error(fault);
    lastFault = fault;
  }
}

createMonitorApi({ database, queries: new MonitorQueries(database), archive: new PostgresNoteArchive(database), feed }).listen(PORT, '127.0.0.1', () => {
  console.log(`The monitor serves http://127.0.0.1:${PORT}`);
});
repeatedly(sampleLimits, SAMPLE_LIMITS_EVERY_MS);
repeatedly(readActivity, READ_ACTIVITY_EVERY_MS);
