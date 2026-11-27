export type Tool = 'claude' | 'antigravity';
export type AgentKind = 'agent' | 'langgraph' | 'skill' | 'tool';
export type Percent = number | 'unknown';

export interface PromptSummary {
  readonly id: string;
  readonly tool: Tool;
  readonly model: string;
  readonly workspace: string;
  readonly conversationId?: string;
  readonly threadId?: string;
  readonly threadTitle?: string;
  readonly text: string;
  readonly askedOn: string;
  readonly finishedOn: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly fiveHourPercent: Percent;
  readonly weeklyPercent: Percent;
  readonly percentEstimated: boolean;
  readonly errors: readonly string[];
  readonly agents: readonly string[];
  readonly toolsUsed: number;
}

export interface AgentCall {
  readonly id: string;
  readonly agent: string;
  readonly kind: AgentKind;
  readonly request: string;
  readonly response: string;
  readonly failed: boolean;
  readonly calledOn: string;
  readonly calledBy: string;
}

export const CALLED_BY_ASSISTANT = '';

export interface PromptDetail extends Omit<PromptSummary, 'agents' | 'toolsUsed'> {
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

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  if (safe < 60) {
    return `${safe} s`;
  }
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
