import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { toolCallsOfSubagent } from './claude-transcript.js';
import type { PromptRecord } from './prompt-record.js';

export interface SubagentTranscript {
  readonly calledBy: string;
  readonly depth: number;
  readonly lines: readonly string[];
}

const SUBAGENTS_FOLDER = 'subagents';
const META_SUFFIX = '.meta.json';
const TRANSCRIPT_SUFFIX = '.jsonl';

export function withSubagentCalls(prompts: readonly PromptRecord[], subagents: readonly SubagentTranscript[]): PromptRecord[] {
  const callsByPrompt = new Map(prompts.map((prompt) => [prompt.id, [...prompt.agentCalls]]));
  const promptOfCall = new Map(prompts.flatMap((prompt) => prompt.agentCalls.map((call) => [call.id, prompt.id] as const)));
  for (const subagent of [...subagents].sort((first, second) => first.depth - second.depth)) {
    const promptId = promptOfCall.get(subagent.calledBy);
    if (promptId !== undefined) {
      const calls = toolCallsOfSubagent(subagent.lines, subagent.calledBy);
      callsByPrompt.get(promptId)?.push(...calls);
      calls.forEach((call) => promptOfCall.set(call.id, promptId));
    }
  }
  return prompts.map((prompt) => ({ ...prompt, agentCalls: callsByPrompt.get(prompt.id) ?? prompt.agentCalls }));
}

export async function subagentTranscriptsBeside(transcriptPath: string): Promise<SubagentTranscript[]> {
  const folder = join(transcriptPath.replace(/\.jsonl$/, ''), SUBAGENTS_FOLDER);
  const names = await readdir(folder).catch((): string[] => []);
  const metas = names.filter((name) => name.endsWith(META_SUFFIX));
  const transcripts = await Promise.all(metas.map((meta) => subagentTranscriptOf(folder, meta)));
  return transcripts.flat();
}

async function subagentTranscriptOf(folder: string, metaName: string): Promise<SubagentTranscript[]> {
  const meta: unknown = JSON.parse(await readFile(join(folder, metaName), 'utf8').catch(() => '{}'));
  const calledBy = textOf(meta, 'toolUseId');
  const depth = numberOf(meta, 'spawnDepth');
  const lines = await readFile(join(folder, metaName.replace(META_SUFFIX, TRANSCRIPT_SUFFIX)), 'utf8').catch(() => '');
  return calledBy === '' || lines === '' ? [] : [{ calledBy, depth, lines: lines.split('\n') }];
}

function textOf(value: unknown, key: string): string {
  const field = isRecord(value) ? value[key] : '';
  return typeof field === 'string' ? field : '';
}

function numberOf(value: unknown, key: string): number {
  const field = isRecord(value) ? value[key] : 0;
  return typeof field === 'number' ? field : 0;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}
