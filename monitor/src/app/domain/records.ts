import type { AgentKind, Tool } from './prompt';

export type TimeWindow = '5h' | 'weekly';

export interface LimitReading {
  readonly tool: Tool;
  readonly pool: string;
  readonly window: TimeWindow;
  readonly usedPercent: number;
  readonly resetsOn: string;
  readonly sampledOn: string;
  readonly stale: boolean;
}

export interface DayOfTokens {
  readonly day: string;
  readonly tool: Tool;
  readonly tokens: number;
  readonly cachedTokens: number;
  readonly prompts: number;
}

export interface StepTotals {
  readonly step: string;
  readonly runs: number;
  readonly failures: number;
  readonly averageSeconds: number;
}

export interface AgentTotals {
  readonly agent: string;
  readonly kind: AgentKind;
  readonly calls: number;
  readonly failures: number;
}

export interface Telemetry {
  readonly tokensByDay: readonly DayOfTokens[];
  readonly steps: readonly StepTotals[];
  readonly agents: readonly AgentTotals[];
}

export interface Problem {
  readonly occurredOn: string;
  readonly source: 'prompt' | 'agent' | 'step';
  readonly tool: Tool | 'langgraph';
  readonly where: string;
  readonly message: string;
  readonly promptId: string;
}

export interface Note {
  readonly id: string;
  readonly kind: 'idea' | 'plan' | 'decision' | 'research';
  readonly status: 'open' | 'done' | 'dropped';
  readonly project: string;
  readonly title: string;
  readonly body: string;
  readonly keywords: readonly string[];
  readonly sources: readonly string[];
  readonly updatedOn: string;
}

export const NO_TELEMETRY: Telemetry = { tokensByDay: [], steps: [], agents: [] };

export const WINDOW_NAMES: Readonly<Record<TimeWindow, string>> = { '5h': '5 horas', weekly: 'Semana' };

export const POOL_NAMES: Readonly<Record<string, string>> = {
  'all models': 'Todos os modelos',
  estimate: 'estimativa',
  gemini: 'Gemini Flash e Pro',
  '3p': 'Claude e GPT-OSS',
  'gemini-argon-wtu': 'Gemini Argon',
};

export function largestDayOf(days: readonly DayOfTokens[]): number {
  return days.reduce((largest, day) => Math.max(largest, day.tokens), 0);
}

export function matchesProblem(problem: Problem, filter: { readonly tool: string; readonly text: string }): boolean {
  const wanted = filter.text.trim().toLowerCase();
  const inTool = filter.tool === '' || problem.tool === filter.tool;
  return inTool && (wanted === '' || `${problem.where} ${problem.message}`.toLowerCase().includes(wanted));
}
