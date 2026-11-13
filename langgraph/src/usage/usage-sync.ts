import { readFile } from 'node:fs/promises';
import { promptsOfAntigravityTranscript } from './antigravity-transcript.js';
import { promptsOfClaudeTranscript } from './claude-transcript.js';
import type { PromptRecord } from './prompt-record.js';
import { transcriptsChangedWithin, type TranscriptFile } from './transcript-files.js';
import type { UsageLedger } from './usage-ledger.js';

const DAYS_LOOKED_BACK = 30;

export class UsageSync {
  constructor(private readonly ledger: UsageLedger) {}

  async readNewActivity(): Promise<number> {
    const changed = await this.ledger.notYetRead(await transcriptsChangedWithin(DAYS_LOOKED_BACK));
    for (const file of changed) {
      await this.ledger.keep(file, await promptsIn(file));
    }
    return changed.length;
  }
}

async function promptsIn(file: TranscriptFile): Promise<PromptRecord[]> {
  const lines = (await readFile(file.path, 'utf8')).split('\n');
  return file.tool === 'claude'
    ? promptsOfClaudeTranscript(lines)
    : promptsOfAntigravityTranscript({ conversationId: file.conversationId, lines });
}
