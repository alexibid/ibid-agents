import { numberIn, objectIn, objectsIn, parsedLines, textIn, type JsonObject } from './json-reading.js';
import {
  clipped,
  clippedForTool,
  isLangGraphTool,
  langGraphRequest,
  requestIn,
  sumOf,
  type AgentCall,
  type PromptRecord,
  type TokenCount,
} from './prompt-record.js';

export interface AntigravityConversation {
  readonly conversationId: string;
  readonly lines: readonly string[];
}

interface OpenPrompt {
  readonly id: string;
  readonly text: string;
  readonly askedOn: string;
  finishedOn: string;
  readonly tokens: TokenCount[];
  readonly calls: AgentCall[];
  readonly awaitingAnswer: number[];
  readonly errors: string[];
}

const USER_INPUT = 'USER_INPUT';
const PLANNER_RESPONSE = 'PLANNER_RESPONSE';
const FAILED = 'ERROR';
const SUBAGENT_TOOL = /agent/i;

export function promptsOfAntigravityTranscript({ conversationId, lines }: AntigravityConversation): PromptRecord[] {
  const prompts: OpenPrompt[] = [];
  for (const line of parsedLines(lines)) {
    if (line['type'] === USER_INPUT) {
      prompts.push(opened(conversationId, line));
    } else {
      const current = prompts.at(-1);
      if (current !== undefined) {
        continueWith(current, line);
      }
    }
  }
  return prompts.map((prompt) => recordOf(prompt, conversationId));
}

function opened(conversationId: string, line: JsonObject): OpenPrompt {
  const askedOn = textIn(line, 'created_at');
  return {
    id: `antigravity:${conversationId}:${numberIn(line, 'step_index')}`,
    text: clipped(requestIn(textIn(line, 'content')) || textIn(line, 'content').trim()),
    askedOn,
    finishedOn: askedOn,
    tokens: [],
    calls: [],
    awaitingAnswer: [],
    errors: [],
  };
}

function continueWith(prompt: OpenPrompt, line: JsonObject): void {
  prompt.finishedOn = textIn(line, 'created_at') || prompt.finishedOn;
  if (line['status'] === FAILED && textIn(line, 'error') !== '') {
    prompt.errors.push(clipped(textIn(line, 'error')));
  }
  if (line['type'] === PLANNER_RESPONSE) {
    readPlannerStep(prompt, line);
  } else {
    answerOldestCall(prompt, line);
  }
}

function readPlannerStep(prompt: OpenPrompt, line: JsonObject): void {
  prompt.tokens.push({
    input: numberIn(line, 'input_tokens'),
    output: numberIn(line, 'output_tokens'),
    cacheRead: numberIn(line, 'cache_read_tokens'),
    cacheWrite: 0,
  });
  objectsIn(line, 'tool_calls').forEach((toolCall, position) => {
    const call = callOf(toolCall, `${prompt.id}:${numberIn(line, 'step_index')}:${position}`, prompt.finishedOn);
    prompt.awaitingAnswer.push(prompt.calls.push(call) - 1);
  });
}

function answerOldestCall(prompt: OpenPrompt, line: JsonObject): void {
  const position = prompt.awaitingAnswer.shift();
  const call = position === undefined ? undefined : prompt.calls[position];
  if (position !== undefined && call !== undefined) {
    const content = textIn(line, 'content');
    const response = call.kind === 'tool' ? clippedForTool(content) : clipped(content);
    prompt.calls[position] = { ...call, response, failed: line['status'] === FAILED };
  }
}

function callOf(toolCall: JsonObject, id: string, calledOn: string): AgentCall {
  const name = textIn(toolCall, 'name');
  const args = objectIn(toolCall, 'args');
  const base = { id, response: '', failed: false, calledOn };
  if (isLangGraphTool(name)) {
    return { ...base, kind: 'langgraph', agent: 'LangGraph', request: langGraphRequest(name, args) };
  }
  return SUBAGENT_TOOL.test(name)
    ? { ...base, kind: 'agent', agent: name, request: clipped(JSON.stringify(args, null, 2)) }
    : { ...base, kind: 'tool', agent: name, request: clippedForTool(JSON.stringify(args, null, 2)) };
}

function recordOf(prompt: OpenPrompt, conversationId: string): PromptRecord {
  return {
    id: prompt.id,
    tool: 'antigravity',
    conversationId,
    workspace: '',
    model: '',
    text: prompt.text,
    askedOn: prompt.askedOn,
    finishedOn: prompt.finishedOn,
    tokens: sumOf(prompt.tokens),
    agentCalls: prompt.calls,
    errors: prompt.errors,
  };
}
