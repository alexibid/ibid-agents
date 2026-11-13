#!/usr/bin/env node
import { text } from 'node:stream/consumers';
import { keepClaudeStatusLine } from './limits/claude-limits.js';
import { samplesOfClaudeStatusLine } from './limits/limit-sample.js';

const rawStatusLine = await text(process.stdin);
await keepClaudeStatusLine(rawStatusLine);

try {
  const shown = samplesOfClaudeStatusLine(JSON.parse(rawStatusLine)).map((sample) => `${sample.window} ${Math.round(sample.usedPercent)}%`);
  process.stdout.write(shown.join(' · '));
} catch {
  process.stdout.write('');
}
