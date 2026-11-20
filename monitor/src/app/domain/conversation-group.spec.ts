import { describe, expect, it } from 'vitest';
import { groupConversations, summarizeEntryTitle } from './conversation-group';
import type { PromptSummary } from './prompt';

function promptOf(overrides: Partial<PromptSummary>): PromptSummary {
  return {
    id: 'p-1',
    tool: 'claude',
    model: 'claude-sonnet',
    workspace: 'ibid-agents',
    conversationId: 'conv-1',
    threadId: 'thread-1',
    threadTitle: '',
    text: 'Primeiro pedido da conversa',
    askedOn: '2026-11-19T11:00:00.000Z',
    finishedOn: '2026-11-19T11:01:00.000Z',
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    fiveHourPercent: 2,
    weeklyPercent: 0.5,
    percentEstimated: false,
    errors: [],
    agents: ['LangGraph'],
    toolsUsed: 2,
    ...overrides,
  };
}

describe('groupConversations', () => {
  it('should aggregate prompts from the same shared thread across Claude and Antigravity', () => {
    const groups = groupConversations([
      promptOf({
        id: 'p-2',
        tool: 'antigravity',
        conversationId: 'conv-agy',
        threadId: 'thread-shared',
        threadTitle: 'Passagem de testemunho',
        text: 'Sim trata desta evolução.',
        askedOn: '2026-11-19T12:01:00.000Z',
        inputTokens: 2000,
        outputTokens: 1000,
        fiveHourPercent: 3.5,
        weeklyPercent: 1.25,
        agents: ['assistant'],
        toolsUsed: 4,
      }),
      promptOf({
        id: 'p-1',
        tool: 'claude',
        conversationId: 'conv-claude',
        threadId: 'thread-shared',
        threadTitle: 'Passagem de testemunho',
        text: 'Quero passagem de testemunho entre Claude e Antigravity.',
        askedOn: '2026-11-19T11:52:00.000Z',
        inputTokens: 1000,
        outputTokens: 500,
        fiveHourPercent: 2,
        weeklyPercent: 0.5,
        agents: ['LangGraph'],
        toolsUsed: 2,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: 'thread-shared',
      title: 'Passagem de testemunho',
      startedWith: 'claude',
      tools: ['claude', 'antigravity'],
      totalTokens: 4500,
      fiveHourPercent: 5.5,
      weeklyPercent: 1.75,
      agents: ['LangGraph', 'assistant'],
      toolsUsed: 6,
      lastAskedOn: '2026-11-19T12:01:00.000Z',
    });
    expect(groups[0].prompts.map((item) => item.id)).toEqual(['p-1', 'p-2']);
  });

  it('should sort groups by most recent activity and fall back to the first prompt text as title', () => {
    const groups = groupConversations([
      promptOf({ id: 'p-old', threadId: 't-old', text: 'Conversa antiga', askedOn: '2026-11-19T10:00:00.000Z' }),
      promptOf({ id: 'p-new', threadId: 't-new', text: 'Conversa recente', askedOn: '2026-11-19T12:00:00.000Z' }),
    ]);

    expect(groups.map((group) => group.id)).toEqual(['t-new', 't-old']);
    expect(groups[0].title).toBe('Conversa recente');
  });

  it('should keep unknown percentages when every prompt in the group is unknown', () => {
    const groups = groupConversations([
      promptOf({ id: 'p-1', fiveHourPercent: 'unknown', weeklyPercent: 'unknown' }),
    ]);

    expect(groups[0].fiveHourPercent).toBe('unknown');
    expect(groups[0].weeklyPercent).toBe('unknown');
  });
});

describe('summarizeEntryTitle', () => {
  it('should collapse whitespace and clip long entry prompts at a word boundary', () => {
    const longText = 'Quero que todas as conversas partilhadas entre Claude e Antigravity apareçam agrupadas num único ponto de entrada com um resumo limpo';
    const summary = summarizeEntryTitle(longText);

    expect(summary.length).toBeLessThanOrEqual(111);
    expect(summary.endsWith('…')).toBe(true);
  });
});
