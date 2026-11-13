import { numberIn, objectIn, objectsIn, parsedLines, textIn, type JsonObject } from './json-reading.js';
import {
  clipped,
  clippedForTool,
  isLangGraphTool,
  langGraphRequest,
  requestIn,
  sumOf,
  type AgentCall,
  shortToolName,
  type AgentKind,
  type LimitHit,
  type PromptRecord,
  type TimeWindow,
  type TokenCount,
} from './prompt-record.js';

interface OpenPrompt {
  readonly promptId: string;
  readonly conversationId: string;
  readonly workspace: string;
  readonly text: string;
  readonly askedOn: string;
  finishedOn: string;
  model: string;
  readonly tokensByMessage: Map<string, TokenCount>;
  readonly calls: Map<string, AgentCall>;
  readonly errors: string[];
}

const SUBAGENT_TOOLS = new Set(['Agent', 'Task']);
const SKILL_TOOL = 'Skill';
const DEFAULT_AGENT = 'general-purpose';
const REFUSED = 'rejected';
const HUMAN = 'human';
const WINDOWS: Readonly<Record<string, TimeWindow>> = { five_hour: '5h', seven_day: 'weekly' };

export function promptsOfClaudeTranscript(lines: readonly string[]): PromptRecord[] {
  const prompts: OpenPrompt[] = [];
  for (const line of parsedLines(lines)) {
    if (line['isSidechain'] === true || line['isMeta'] === true) {
      continue;
    }
    const current = prompts.at(-1);
    if (startsPrompt(line, current)) {
      prompts.push(opened(line));
    } else if (current !== undefined) {
      continueWith(current, line);
    }
  }
  return prompts.map(recordOf);
}

export function limitHitsOfClaudeTranscript(lines: readonly string[]): LimitHit[] {
  return parsedLines(lines.filter((line) => line.includes('"quotaLimits"'))).flatMap((line) => {
    const limits = objectIn(line, 'quotaLimits');
    const window = WINDOWS[textIn(limits, 'rateLimitType')];
    const resetsAt = numberIn(limits, 'resetsAt');
    return limits['status'] === REFUSED && window !== undefined && resetsAt > 0
      ? [{ tool: 'claude' as const, window, hitOn: textIn(line, 'timestamp'), resetsOn: new Date(resetsAt * 1000).toISOString() }]
      : [];
  });
}

function startsPrompt(line: JsonObject, current: OpenPrompt | undefined): boolean {
  const promptId = textIn(line, 'promptId');
  return line['type'] === 'user' && promptId !== '' && promptId !== current?.promptId && wasTypedByTheUser(line) && requestOf(line) !== '';
}

function wasTypedByTheUser(line: JsonObject): boolean {
  const origin = textIn(objectIn(line, 'origin'), 'kind');
  const turnOrigin = textIn(line, 'turnOrigin');
  return origin === HUMAN || (origin === '' && (turnOrigin === '' || turnOrigin === HUMAN) && line['isCompactSummary'] !== true);
}

function requestOf(line: JsonObject): string {
  return requestIn(spokenTextOf(line));
}

function opened(line: JsonObject): OpenPrompt {
  const askedOn = textIn(line, 'timestamp');
  return {
    promptId: textIn(line, 'promptId'),
    conversationId: textIn(line, 'sessionId'),
    workspace: textIn(line, 'cwd'),
    text: clipped(requestOf(line)),
    askedOn,
    finishedOn: askedOn,
    model: '',
    tokensByMessage: new Map(),
    calls: new Map(),
    errors: [],
  };
}

function continueWith(prompt: OpenPrompt, line: JsonObject): void {
  prompt.finishedOn = textIn(line, 'timestamp') || prompt.finishedOn;
  if (line['type'] === 'assistant') {
    readAnswer(prompt, line);
  } else if (line['type'] === 'user') {
    readToolResults(prompt, line);
  }
}

function readAnswer(prompt: OpenPrompt, line: JsonObject): void {
  const message = objectIn(line, 'message');
  if (line['isApiErrorMessage'] === true) {
    prompt.errors.push(clipped(textOfBlocks(message)));
    return;
  }
  prompt.model = textIn(message, 'model') || prompt.model;
  prompt.tokensByMessage.set(textIn(message, 'id'), tokensOf(objectIn(message, 'usage')));
  for (const block of objectsIn(message, 'content').filter((entry) => entry['type'] === 'tool_use')) {
    const call = callOf(block, prompt.finishedOn);
    prompt.calls.set(call.id, call);
  }
}

function readToolResults(prompt: OpenPrompt, line: JsonObject): void {
  for (const block of objectsIn(objectIn(line, 'message'), 'content')) {
    const call = prompt.calls.get(textIn(block, 'tool_use_id'));
    if (block['type'] === 'tool_result' && call !== undefined) {
      const response = call.kind === 'tool' ? clippedForTool(resultTextOf(block)) : clipped(resultTextOf(block));
      prompt.calls.set(call.id, { ...call, response, failed: block['is_error'] === true });
    }
  }
}

function callOf(block: JsonObject, calledOn: string): AgentCall {
  const name = textIn(block, 'name');
  const input = objectIn(block, 'input');
  const base = { id: textIn(block, 'id'), response: '', failed: false, calledOn };
  if (SUBAGENT_TOOLS.has(name)) {
    return { ...base, ...named('agent', textIn(input, 'subagent_type') || DEFAULT_AGENT), request: clipped(textIn(input, 'prompt')) };
  }
  if (name === SKILL_TOOL) {
    return { ...base, ...named('skill', textIn(input, 'skill')), request: clipped(textIn(input, 'args')) };
  }
  if (isLangGraphTool(name)) {
    return { ...base, ...named('langgraph', 'LangGraph'), request: langGraphRequest(name, input) };
  }
  return { ...base, ...named('tool', shortToolName(name)), request: clippedForTool(JSON.stringify(input, null, 2)) };
}

function named(kind: AgentKind, agent: string): { readonly kind: AgentKind; readonly agent: string } {
  return { kind, agent };
}

function tokensOf(usage: JsonObject): TokenCount {
  return {
    input: numberIn(usage, 'input_tokens'),
    output: numberIn(usage, 'output_tokens'),
    cacheRead: numberIn(usage, 'cache_read_input_tokens'),
    cacheWrite: numberIn(usage, 'cache_creation_input_tokens'),
  };
}

function spokenTextOf(line: JsonObject): string {
  const message = objectIn(line, 'message');
  const content = message['content'];
  if (typeof content === 'string') {
    return content.trim();
  }
  const blocks = objectsIn(message, 'content');
  return blocks.some((block) => block['type'] === 'tool_result') ? '' : textOfBlocks(message);
}

function textOfBlocks(message: JsonObject): string {
  return objectsIn(message, 'content')
    .map((block) => textIn(block, 'text'))
    .filter((text) => text !== '')
    .join('\n')
    .trim();
}

function resultTextOf(block: JsonObject): string {
  return typeof block['content'] === 'string' ? block['content'] : textOfBlocks(block);
}

function recordOf(prompt: OpenPrompt): PromptRecord {
  return {
    id: `claude:${prompt.conversationId}:${prompt.promptId}`,
    tool: 'claude',
    conversationId: prompt.conversationId,
    workspace: prompt.workspace,
    model: prompt.model,
    text: prompt.text,
    askedOn: prompt.askedOn,
    finishedOn: prompt.finishedOn,
    tokens: sumOf([...prompt.tokensByMessage.values()]),
    agentCalls: [...prompt.calls.values()],
    errors: prompt.errors,
  };
}
