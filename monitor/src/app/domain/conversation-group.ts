import { secondsTakenBy, tokensSpentOn, type Percent, type PromptSummary, type Tool } from './prompt';

export interface ConversationGroup {
  readonly id: string;
  readonly title: string;
  readonly startedWith: Tool;
  readonly tools: readonly Tool[];
  readonly firstAskedOn: string;
  readonly lastAskedOn: string;
  readonly totalSeconds: number;
  readonly totalTokens: number;
  readonly fiveHourPercent: Percent;
  readonly weeklyPercent: Percent;
  readonly percentEstimated: boolean;
  readonly agents: readonly string[];
  readonly toolsUsed: number;
  readonly errorCount: number;
  readonly prompts: readonly PromptSummary[];
}

const MAX_TITLE_LENGTH = 110;

export function groupConversations(prompts: readonly PromptSummary[]): ConversationGroup[] {
  const buckets = new Map<string, PromptSummary[]>();
  for (const prompt of prompts) {
    const key = threadKeyOf(prompt);
    const list = buckets.get(key) ?? [];
    list.push(prompt);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .map(([id, items]) => toGroup(id, items))
    .sort((first, second) => Date.parse(second.lastAskedOn) - Date.parse(first.lastAskedOn));
}

export function summarizeEntryTitle(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= MAX_TITLE_LENGTH) {
    return collapsed;
  }
  const clipped = collapsed.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = clipped.lastIndexOf(' ');
  const boundary = lastSpace > MAX_TITLE_LENGTH / 2 ? lastSpace : MAX_TITLE_LENGTH;
  return `${clipped.slice(0, boundary).trimEnd()}…`;
}

function toGroup(id: string, items: readonly PromptSummary[]): ConversationGroup {
  const chronological = [...items].sort((first, second) => Date.parse(first.askedOn) - Date.parse(second.askedOn));
  const entry = chronological[0];
  const latest = chronological[chronological.length - 1];
  const explicitTitle = chronological.find((item) => (item.threadTitle ?? '').trim() !== '')?.threadTitle?.trim() ?? '';
  const tools = uniqueTools(chronological);
  const agents = uniqueAgents(chronological);

  return {
    id,
    title: explicitTitle !== '' ? explicitTitle : summarizeEntryTitle(entry.text),
    startedWith: entry.tool,
    tools,
    firstAskedOn: entry.askedOn,
    lastAskedOn: latest.askedOn,
    totalSeconds: chronological.reduce((sum, item) => sum + secondsTakenBy(item), 0),
    totalTokens: chronological.reduce((sum, item) => sum + tokensSpentOn(item), 0),
    fiveHourPercent: sumPercents(chronological.map((item) => item.fiveHourPercent)),
    weeklyPercent: sumPercents(chronological.map((item) => item.weeklyPercent)),
    percentEstimated: chronological.some((item) => item.percentEstimated),
    agents,
    toolsUsed: chronological.reduce((sum, item) => sum + item.toolsUsed, 0),
    errorCount: chronological.reduce((sum, item) => sum + item.errors.length, 0),
    prompts: chronological,
  };
}

function threadKeyOf(prompt: PromptSummary): string {
  const thread = (prompt.threadId ?? '').trim();
  if (thread !== '') {
    return thread;
  }
  const conversation = (prompt.conversationId ?? '').trim();
  return conversation !== '' ? conversation : prompt.id;
}

function uniqueTools(prompts: readonly PromptSummary[]): Tool[] {
  const seen = new Set<Tool>();
  const ordered: Tool[] = [];
  for (const prompt of prompts) {
    if (!seen.has(prompt.tool)) {
      seen.add(prompt.tool);
      ordered.push(prompt.tool);
    }
  }
  return ordered;
}

function uniqueAgents(prompts: readonly PromptSummary[]): string[] {
  const seen = new Set<string>();
  for (const prompt of prompts) {
    for (const agent of prompt.agents) {
      seen.add(agent);
    }
  }
  return [...seen];
}

function sumPercents(values: readonly Percent[]): Percent {
  const known = values.filter((value): value is number => typeof value === 'number');
  if (known.length === 0) {
    return 'unknown';
  }
  return known.reduce((sum, value) => sum + value, 0);
}
