export type Tool = 'claude' | 'antigravity';
export type AgentKind = 'agent' | 'langgraph' | 'skill' | 'tool';
export type TimeWindow = '5h' | 'weekly';

export interface TokenCount {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
}

export interface AgentCall {
  readonly id: string;
  readonly agent: string;
  readonly kind: AgentKind;
  readonly request: string;
  readonly response: string;
  readonly failed: boolean;
  readonly calledOn: string;
}

export interface PromptRecord {
  readonly id: string;
  readonly tool: Tool;
  readonly conversationId: string;
  readonly workspace: string;
  readonly model: string;
  readonly text: string;
  readonly askedOn: string;
  readonly finishedOn: string;
  readonly tokens: TokenCount;
  readonly agentCalls: readonly AgentCall[];
  readonly errors: readonly string[];
}

export interface LimitHit {
  readonly tool: Tool;
  readonly window: TimeWindow;
  readonly hitOn: string;
  readonly resetsOn: string;
}

export const NO_TOKENS: TokenCount = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

const LONGEST_KEPT_TEXT = 20_000;
const LONGEST_KEPT_TOOL_TEXT = 1_500;
const LANGGRAPH_SERVER = 'ibid-langgraph';
const NOT_A_REQUEST = '';
const WRAPPED_REQUEST = /<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/;
const COMMAND_NAME = /<command-(?:message|name)>\/?([\s\S]*?)<\/command-(?:message|name)>/;
const COMMAND_ARGUMENTS = /<command-args>([\s\S]*?)<\/command-args>/;
const TAGGED_BLOCK = /<([a-z-]+)>[\s\S]*?<\/\1>/g;
const TOOL_WRITTEN = /^(?:<|\[Request interrupted|This session is being continued)/;

export function requestIn(rawText: string): string {
  const text = rawText.trim();
  const wrapped = WRAPPED_REQUEST.exec(text)?.[1];
  if (wrapped !== undefined) {
    return wrapped.trim();
  }
  const command = COMMAND_NAME.exec(text)?.[1];
  const typedAfterCommand = text.replace(TAGGED_BLOCK, '').trim();
  if (command !== undefined && typedAfterCommand !== '') {
    return typedAfterCommand;
  }
  if (command !== undefined) {
    return `/${command.trim()} ${COMMAND_ARGUMENTS.exec(text)?.[1]?.trim() ?? ''}`.trim();
  }
  return TOOL_WRITTEN.test(text) ? NOT_A_REQUEST : text;
}

export function clipped(text: string): string {
  return shortened(text, LONGEST_KEPT_TEXT);
}

export function clippedForTool(text: string): string {
  return shortened(text, LONGEST_KEPT_TOOL_TEXT);
}

function shortened(text: string, longest: number): string {
  const storable = text.replaceAll('\u0000', '');
  return storable.length <= longest ? storable : `${storable.slice(0, longest)}…`;
}

export function shortToolName(toolName: string): string {
  return toolName.split('__').at(-1) ?? toolName;
}

export function sumOf(counts: readonly TokenCount[]): TokenCount {
  return counts.reduce(
    (total, count) => ({
      input: total.input + count.input,
      output: total.output + count.output,
      cacheRead: total.cacheRead + count.cacheRead,
      cacheWrite: total.cacheWrite + count.cacheWrite,
    }),
    NO_TOKENS,
  );
}

export function isLangGraphTool(toolName: string): boolean {
  return toolName.includes(LANGGRAPH_SERVER);
}

export function langGraphRequest(toolName: string, input: unknown): string {
  const action = toolName.split(/__|[./:]/).at(-1) ?? toolName;
  return clipped(`${action}\n${JSON.stringify(input, null, 2)}`);
}
