import { readFile } from 'node:fs/promises';
import { promptsOfAntigravityTranscript } from './antigravity-transcript.js';
import { subagentTranscriptsBeside, withSubagentWork } from './claude-subagents.js';
import { limitHitsOfClaudeTranscript, promptsOfClaudeTranscript } from './claude-transcript.js';
import { transcriptsChangedWithin, type TranscriptFile } from './transcript-files.js';
import type { TranscriptContent, UsageLedger } from './usage-ledger.js';

const DAYS_LOOKED_BACK = 120;

export class UsageSync {
  constructor(private readonly ledger: UsageLedger) {}

  async readNewActivity(): Promise<number> {
    const changed = await this.ledger.notYetRead(await transcriptsChangedWithin(DAYS_LOOKED_BACK));
    for (const file of changed) {
      await this.ledger.keep(file, await contentOf(file));
    }
    return changed.length;
  }
}

async function contentOf(file: TranscriptFile): Promise<TranscriptContent> {
  const lines = (await readFile(file.path, 'utf8')).split('\n');
  if (file.tool !== 'claude') {
    return { prompts: promptsOfAntigravityTranscript({ conversationId: file.conversationId, lines }), limitHits: [] };
  }
  const prompts = withSubagentWork(promptsOfClaudeTranscript(lines), await subagentTranscriptsBeside(file.path));
  return { prompts, limitHits: limitHitsOfClaudeTranscript(lines) };
}
