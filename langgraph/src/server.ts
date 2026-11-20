#!/usr/bin/env node
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { engineProcess } from './relay/engine-process.js';
import { RESTART_SIGNAL } from './relay/restart-signal-file.js';
import { whenAnyChanges } from './relay/restart-signals.js';
import { StdioRelay } from './relay/stdio-relay.js';

const ENGINE_SCRIPT = join(import.meta.dirname, 'engine.js');
const RELAUNCH_AFTER_CRASH_MS = 2000;

const relay = new StdioRelay(
  engineProcess(ENGINE_SCRIPT),
  { send: (line) => process.stdout.write(`${line}\n`) },
  (relaunch) => setTimeout(relaunch, RELAUNCH_AFTER_CRASH_MS),
);

function shutDown(): void {
  relay.shutDown();
  setTimeout(() => process.exit(0), 200);
}

createInterface({ input: process.stdin })
  .on('line', (line) => relay.fromClient(line))
  .on('close', shutDown);
process.on('SIGTERM', shutDown);
whenAnyChanges([ENGINE_SCRIPT, RESTART_SIGNAL], () => relay.restart());
