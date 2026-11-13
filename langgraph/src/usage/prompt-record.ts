export type Tool = 'claude' | 'antigravity';
export type AgentKind = 'agent' | 'langgraph' | 'skill';

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

export const NO_TOKENS: TokenCount = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

const LONGEST_KEPT_TEXT = 20_000;
const LANGGRAPH_SERVER = 'ibid-langgraph';

export function clipped(text: string): string {
  return text.length <= LONGEST_KEPT_TEXT ? text : `${text.slice(0, LONGEST_KEPT_TEXT)}…`;
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
