#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATABASE_DIRECTORY = import.meta.dirname;
const SETTINGS_FILE = join(DATABASE_DIRECTORY, '.env');
const DEFAULT_PORT = 54329;
const OWNER_ONLY = 0o600;

function createSettingsOnce() {
  if (existsSync(SETTINGS_FILE)) {
    return;
  }
  const password = randomBytes(24).toString('hex');
  writeFileSync(SETTINGS_FILE, `POSTGRES_PASSWORD=${password}\nIBID_DATABASE_PORT=${DEFAULT_PORT}\n`, { mode: OWNER_ONLY });
  console.log(`Created ${SETTINGS_FILE} with a generated password.`);
}

function startContainer() {
  const started = spawnSync('docker', ['compose', 'up', '--detach', '--wait'], { cwd: DATABASE_DIRECTORY, stdio: 'inherit' });
  if (started.status !== 0) {
    throw new Error('Docker did not start the database. Is Docker (OrbStack) running?');
  }
}

try {
  createSettingsOnce();
  startContainer();
  console.log('The database is running.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
