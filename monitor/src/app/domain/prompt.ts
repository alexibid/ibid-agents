export type Tool = 'claude' | 'antigravity';
export type AgentKind = 'agent' | 'langgraph' | 'skill';
export type Percent = number | 'unknown';

export interface PromptSummary {
  readonly id: string;
  readonly tool: Tool;
  readonly model: string;
  readonly workspace: string;
  readonly text: string;
  readonly askedOn: string;
  readonly finishedOn: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly fiveHourPercent: Percent;
  readonly weeklyPercent: Percent;
  readonly errors: readonly string[];
  readonly agents: readonly string[];
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

export interface PromptDetail extends Omit<PromptSummary, 'agents'> {
  readonly calls: readonly AgentCall[];
}

export type TokenUse = Pick<PromptSummary, 'inputTokens' | 'outputTokens' | 'cacheWriteTokens'>;

export const TOOL_NAMES: Readonly<Record<Tool, string>> = { claude: 'Claude', antigravity: 'Antigravity' };

export function tokensSpentOn(prompt: TokenUse): number {
  return prompt.inputTokens + prompt.outputTokens + prompt.cacheWriteTokens;
}

export function secondsTakenBy(prompt: Pick<PromptSummary, 'askedOn' | 'finishedOn'>): number {
  return Math.max(0, Math.round((Date.parse(prompt.finishedOn) - Date.parse(prompt.askedOn)) / 1000));
}
