#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const PROJECT_FOLDERS = ['apps', 'libs'];
const AGENT_ENTRIES = [
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.agents',
  '.gemini',
  '.claude',
  '.opencode',
  'opencode.json',
  '.github/agents',
  '.github/prompts',
  '.github/skills',
];

class UsageError extends Error {}

function readArguments(argv) {
  const workspace = argv.find((argument) => !argument.startsWith('--'));
  if (workspace === undefined) {
    throw new UsageError('Usage: node install/clear-workspace.mjs <workspace path> [--apply]');
  }
  return { workspace: resolve(workspace), apply: argv.includes('--apply') };
}

function projectRoots(workspace) {
  const projects = PROJECT_FOLDERS.flatMap((folder) =>
    readdirSync(join(workspace, folder), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(folder, entry.name)),
  );
  return ['', ...projects];
}

function agentEntries(workspace) {
  return projectRoots(workspace)
    .flatMap((root) => AGENT_ENTRIES.map((name) => join(root, name)))
    .filter((entry) => existsSync(join(workspace, entry)));
}

function timestamp() {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
}

function backUp(workspace, entries) {
  const backup = join(homedir(), 'Desktop', `ibid-workspace-agents-backup-${timestamp()}`);
  for (const entry of entries) {
    mkdirSync(dirname(join(backup, entry)), { recursive: true });
    cpSync(join(workspace, entry), join(backup, entry), { recursive: true, verbatimSymlinks: true, preserveTimestamps: true });
  }
  assertBackedUp(backup, entries);
  return backup;
}

function assertBackedUp(backup, entries) {
  const missing = entries.filter((entry) => !existsSync(join(backup, entry)));
  if (missing.length > 0) {
    throw new Error(`The backup is incomplete, so nothing was removed:\n${missing.join('\n')}`);
  }
}

function moveToTrash(workspace, entries) {
  const trash = join(homedir(), '.Trash', `ibid-workspace-agents-${timestamp()}`);
  for (const entry of entries) {
    mkdirSync(dirname(join(trash, entry)), { recursive: true });
    renameSync(join(workspace, entry), join(trash, entry));
  }
  return trash;
}

function run({ workspace, apply }) {
  const entries = agentEntries(workspace);
  entries.forEach((entry) => console.log(`[remove] ${entry}`));
  if (!apply) {
    console.log('Nothing was changed. Add --apply to back these up on the Desktop and move them to the Trash.');
    return;
  }
  console.log(`Backed up to ${backUp(workspace, entries)}`);
  console.log(`Moved to ${moveToTrash(workspace, entries)}`);
}

try {
  run(readArguments(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
