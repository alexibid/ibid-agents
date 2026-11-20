import type { Database, Row, Statement } from '../store/database.js';
import type { AgentCall, LimitHit, PromptRecord } from './prompt-record.js';
import type { TranscriptFile } from './transcript-files.js';

interface KnownFileRow extends Row {
  readonly path: string;
  readonly size_bytes: string;
  readonly modified_at: Date;
}

const KNOWN_FILES = 'select path, size_bytes, modified_at from transcript_files';

const SAVE_FILE = `
  insert into transcript_files (path, tool, size_bytes, modified_at) values ($1, $2, $3, $4)
  on conflict (path) do update set size_bytes = excluded.size_bytes, modified_at = excluded.modified_at`;

const SAVE_PROMPT = `
  insert into prompts (id, tool, conversation_id, workspace, model, text, asked_at, finished_at,
    input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, errors)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  on conflict (id) do update set
    model = excluded.model, text = excluded.text, finished_at = excluded.finished_at,
    input_tokens = excluded.input_tokens, output_tokens = excluded.output_tokens,
    cache_read_tokens = excluded.cache_read_tokens, cache_write_tokens = excluded.cache_write_tokens,
    errors = excluded.errors`;

const SAVE_CALL = `
  insert into agent_calls (id, prompt_id, agent, kind, request, response, failed, called_at, called_by)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  on conflict (id) do update set
    agent = excluded.agent, kind = excluded.kind, response = excluded.response, failed = excluded.failed,
    called_by = excluded.called_by`;

const SAVE_HIT = `
  insert into limit_hits (tool, time_window, hit_at, resets_at) values ($1, $2, $3, $4)
  on conflict (tool, time_window, resets_at) do update set hit_at = least(limit_hits.hit_at, excluded.hit_at)`;

export interface TranscriptContent {
  readonly prompts: readonly PromptRecord[];
  readonly limitHits: readonly LimitHit[];
}

export class UsageLedger {
  constructor(private readonly database: Database) {}

  async notYetRead(files: readonly TranscriptFile[]): Promise<TranscriptFile[]> {
    const known = new Map((await this.database.rows<KnownFileRow>(KNOWN_FILES)).map((row) => [row.path, row]));
    return files.filter((file) => {
      const seen = known.get(file.path);
      return seen === undefined || Number(seen.size_bytes) !== file.sizeBytes || seen.modified_at.getTime() !== file.modifiedOn.getTime();
    });
  }

  async keep(file: TranscriptFile, { prompts, limitHits }: TranscriptContent): Promise<void> {
    const dated = prompts.filter((prompt) => prompt.askedOn !== '');
    await this.database.inOneTransaction([
      ...dated.flatMap((prompt) => [promptStatement(prompt), ...prompt.agentCalls.map((call) => callStatement(prompt, call))]),
      ...limitHits.map((hit) => ({ text: SAVE_HIT, values: [hit.tool, hit.window, hit.hitOn, hit.resetsOn] })),
      { text: SAVE_FILE, values: [file.path, file.tool, file.sizeBytes, file.modifiedOn] },
    ]);
  }
}

function promptStatement(prompt: PromptRecord): Statement {
  const { tokens } = prompt;
  return {
    text: SAVE_PROMPT,
    values: [
      prompt.id,
      prompt.tool,
      prompt.conversationId,
      prompt.workspace,
      prompt.model,
      prompt.text,
      prompt.askedOn,
      prompt.finishedOn,
      tokens.input,
      tokens.output,
      tokens.cacheRead,
      tokens.cacheWrite,
      prompt.errors,
    ],
  };
}

function callStatement(prompt: PromptRecord, call: AgentCall): Statement {
  return {
    text: SAVE_CALL,
    values: [call.id, prompt.id, call.agent, call.kind, call.request, call.response, call.failed, call.calledOn || prompt.askedOn, call.calledBy],
  };
}
