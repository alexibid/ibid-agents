#!/usr/bin/env node
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { text } from 'node:stream/consumers';
import { answerFor, invokedFlows, promptOf, reminderFor } from './agent-runs/reminder.js';

const SKILLS = resolve(import.meta.dirname, '..', '..', 'skills');

const NO_FILES: string[] = [];

async function agentsWithFlow(): Promise<Set<string>> {
  const folders = await readdir(SKILLS, { withFileTypes: true }).catch(() => []);
  const flows = await Promise.all(
    folders
      .filter((folder) => folder.isDirectory())
      .map(async (folder) => ((await readdir(join(SKILLS, folder.name)).catch(() => NO_FILES)).includes('flow.json') ? folder.name : '')),
  );
  return new Set(flows.filter((name) => name !== ''));
}

const { prompt, tool } = promptOf(await text(process.stdin));
const answer = answerFor(tool, reminderFor(invokedFlows(prompt, await agentsWithFlow())));
if (answer !== '') {
  process.stdout.write(`${answer}\n`);
}
