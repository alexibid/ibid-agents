#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { text } from 'node:stream/consumers';
import { openingContext, sessionDirectoryOf, watchesDirectory } from './session/opening-context.js';
import { GitRepositoryReader, pendingPullNotice, pendingPulls } from './session/pending-pulls.js';

const AGENTS_ROOT = resolve(import.meta.dirname, '..', '..');
const CORE_RULES_FILE = resolve(AGENTS_ROOT, 'rules', 'core.md');

const where = {
  sessionDirectory: sessionDirectoryOf(await text(process.stdin)),
  workspaceRoot: process.env['IBID_WORKSPACE_ROOT'] ?? '',
  agentsRoot: AGENTS_ROOT,
};

const roots = [where.workspaceRoot, where.agentsRoot].filter((root) => root !== '');
const pullNotice = watchesDirectory(where)
  ? pendingPullNotice(await pendingPulls(roots, new GitRepositoryReader()))
  : '';

const context = openingContext({ ...where, pullNotice, coreRules: await readFile(CORE_RULES_FILE, 'utf8') });

if (context !== '') {
  process.stdout.write(`${context}\n`);
}
