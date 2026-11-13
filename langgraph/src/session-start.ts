#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { text } from 'node:stream/consumers';
import { openingContext } from './session/opening-context.js';

const CORE_RULES_FILE = resolve(import.meta.dirname, '..', '..', 'rules', 'core.md');

const context = openingContext({
  rawPayload: await text(process.stdin),
  workspaceRoot: process.env['IBID_WORKSPACE_ROOT'] ?? '',
  coreRules: await readFile(CORE_RULES_FILE, 'utf8'),
});

if (context !== '') {
  process.stdout.write(`${context}\n`);
}
