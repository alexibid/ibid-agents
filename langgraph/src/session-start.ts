#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { text } from 'node:stream/consumers';
import { handoffNotice } from './handoff/handoff.js';
import { PostgresHandoffArchive } from './handoff/handoff-archive.js';
import { openingContext, sessionDirectoryOf, watchesDirectory } from './session/opening-context.js';
import { GitRepositoryReader, pendingPullNotice, pendingPulls } from './session/pending-pulls.js';
import { Database } from './store/database.js';
import { DatabaseNotInstalledError, DatabaseUnavailableError } from './store/database-settings.js';

const AGENTS_ROOT = resolve(import.meta.dirname, '..', '..');
const CORE_RULES_FILE = resolve(AGENTS_ROOT, 'rules', 'core.md');

async function activeHandoffNotice(): Promise<string> {
  const database = new Database();
  try {
    return handoffNotice(await new PostgresHandoffArchive(database).active(''));
  } catch (error) {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseNotInstalledError) {
      return '';
    }
    throw error;
  } finally {
    await database.close();
  }
}

const where = {
  sessionDirectory: sessionDirectoryOf(await text(process.stdin)),
  workspaceRoot: process.env['IBID_WORKSPACE_ROOT'] ?? '',
  agentsRoot: AGENTS_ROOT,
};

const roots = [where.workspaceRoot, where.agentsRoot].filter((root) => root !== '');
const watched = watchesDirectory(where);
const [pullNotice, activeHandoff] = watched
  ? await Promise.all([pendingPulls(roots, new GitRepositoryReader()).then(pendingPullNotice), activeHandoffNotice()])
  : ['', ''];

const context = openingContext({
  ...where,
  pullNotice,
  handoffNotice: activeHandoff,
  coreRules: await readFile(CORE_RULES_FILE, 'utf8'),
});

if (context !== '') {
  process.stdout.write(`${context}\n`);
}
