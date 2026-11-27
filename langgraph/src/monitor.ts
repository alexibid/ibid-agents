#!/usr/bin/env node
import { join } from 'node:path';
import { PostgresBacklogArchive } from './backlog/backlog-archive.js';
import { CommitCloser } from './backlog/commit-closer.js';
import { IssueStateReader } from './backlog/issue-states.js';
import { GithubIssueSync } from './backlog/issue-sync.js';
import { WorkspaceChanges } from './checks/workspace-changes.js';
import { storiesStateFile, workspaceRootBesideAgents } from './configuration.js';
import { readAntigravityLimits } from './limits/antigravity-limits.js';
import { latestStoryThreads } from './store/story-threads.js';
import { ClaudeEstimate } from './limits/claude-estimate.js';
import { readClaudeLimits } from './limits/claude-limits.js';
import { LimitLedger } from './limits/limit-ledger.js';
import { PostgresNoteArchive } from './memory/note-archive.js';
import { ChangeFeed } from './monitor/change-feed.js';
import { fileClock } from './monitor/engine-clock.js';
import { EngineServers } from './monitor/engine-servers.js';
import { IdleServerSweep, TWO_DAYS_OPEN_ONE_DAY_IDLE } from './monitor/idle-servers.js';
import { PsServerProcesses } from './monitor/ps-server-processes.js';
import { ACTIVITY_DIRECTORY, FileServerActivity } from './relay/server-activity.js';
import { RESTART_SIGNAL } from './relay/restart-signal-file.js';
import { createMonitorApi } from './monitor/http-api.js';
import { MonitorQueries } from './monitor/monitor-queries.js';
import { Database } from './store/database.js';
import { UsageLedger } from './usage/usage-ledger.js';
import { UsageSync } from './usage/usage-sync.js';

const PORT = Number(process.env['IBID_MONITOR_PORT'] ?? 4710);
const READ_ACTIVITY_EVERY_MS = 20_000;
const SERVER_SCRIPTS = { relay: join(import.meta.dirname, 'server.js'), engine: join(import.meta.dirname, 'engine.js') };
const STARTED_ON = new Date();
const SAMPLE_LIMITS_EVERY_MS = 60_000;
const SWEEP_IDLE_SERVERS_EVERY_MS = 3_600_000;

const database = new Database();
const serverProcesses = new PsServerProcesses(SERVER_SCRIPTS);
const idleServers = new IdleServerSweep(serverProcesses, new FileServerActivity(ACTIVITY_DIRECTORY), TWO_DAYS_OPEN_ONE_DAY_IDLE);
const feed = new ChangeFeed();
const usageSync = new UsageSync(new UsageLedger(database));
const limitLedger = new LimitLedger(database);
const claudeEstimate = new ClaudeEstimate(database);
const commitCloser = new CommitCloser({
  finishedStories: () => latestStoryThreads(storiesStateFile()).filter(({ status }) => status === 'finished'),
  uncommittedFiles: async () => new Set(Object.keys(await new WorkspaceChanges(workspaceRootBesideAgents()).fingerprint())),
  issueStates: new IssueStateReader(),
  issues: new GithubIssueSync(),
});
let lastFault = '';
let writesInOrder: Promise<unknown> = Promise.resolve();
let samplingNow: Promise<void> | undefined;

function oneAtATime(task: () => Promise<void>): Promise<void> {
  const turn = writesInOrder.then(task);
  writesInOrder = turn.catch(() => undefined);
  return turn;
}

function sampleLimitsNow(): Promise<void> {
  samplingNow ??= oneAtATime(sampleLimits).finally(() => (samplingNow = undefined));
  return samplingNow;
}

async function readActivity(): Promise<void> {
  await usageSync.readNewActivity();
  await limitLedger.shareOutAmongPrompts();
  feed.announce();
}

async function sampleLimits(): Promise<void> {
  const readings = await Promise.allSettled([readAntigravityLimits(), readClaudeLimits(), claudeEstimate.refresh()]);
  const samples = readings.flatMap((reading) => (reading.status === 'fulfilled' ? reading.value : []));
  if (samples.length > 0) {
    await limitLedger.keep(samples);
  }
  const failure = readings.find((reading) => reading.status === 'rejected');
  if (failure !== undefined) {
    throw failure.reason;
  }
}

async function retireIdleServers(): Promise<void> {
  const retired = await idleServers.retire(new Date());
  if (retired.length > 0) {
    console.log(`Stopped idle flow engine servers: ${retired.join(', ')}`);
  }
}

async function closeCommittedStories(): Promise<void> {
  const closed = await commitCloser.closeCommitted();
  if (closed.length > 0) {
    feed.announce();
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

createMonitorApi({
  database,
  queries: new MonitorQueries(database),
  archive: new PostgresNoteArchive(database),
  backlog: new PostgresBacklogArchive(database),
  feed,
  refreshLimits: sampleLimitsNow,
  engine: new EngineServers(serverProcesses, fileClock(SERVER_SCRIPTS.engine, STARTED_ON), RESTART_SIGNAL),
}).listen(PORT, '127.0.0.1', () => {
  console.log(`The monitor serves http://127.0.0.1:${PORT}`);
});
repeatedly(sampleLimitsNow, SAMPLE_LIMITS_EVERY_MS);
repeatedly(closeCommittedStories, SAMPLE_LIMITS_EVERY_MS);
repeatedly(retireIdleServers, SWEEP_IDLE_SERVERS_EVERY_MS);
repeatedly(() => oneAtATime(readActivity), READ_ACTIVITY_EVERY_MS);
