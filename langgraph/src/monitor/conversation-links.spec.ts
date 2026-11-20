import { describe, expect, it } from 'vitest';
import { attachThreads } from './conversation-links.js';

describe('attachThreads', () => {
  it('should keep prompts in the same conversation under the same threadId', () => {
    const enriched = attachThreads(
      [
        { id: 'p-1', conversationId: 'conv-a', tool: 'claude' },
        { id: 'p-2', conversationId: 'conv-a', tool: 'claude' },
        { id: 'p-3', conversationId: 'conv-b', tool: 'antigravity' },
      ],
      [],
    );

    expect(enriched[0]?.['threadId']).toBe('conv-a');
    expect(enriched[1]?.['threadId']).toBe('conv-a');
    expect(enriched[2]?.['threadId']).toBe('conv-b');
  });

  it('should merge Claude and Antigravity conversations that share a handoff id and keep its topic', () => {
    const enriched = attachThreads(
      [
        { id: 'p-1', conversationId: 'conv-claude', tool: 'claude' },
        { id: 'p-2', conversationId: 'conv-agy', tool: 'antigravity' },
      ],
      [
        {
          promptId: 'p-1',
          request: JSON.stringify({ workspace: 'ibid-agents', client: 'claude', topic: 'Cross-interface handoff' }),
          response: JSON.stringify({ id: 'h-99', workspace: 'ibid-agents', client: 'claude', topic: 'Cross-interface handoff' }),
        },
        {
          promptId: 'p-2',
          request: JSON.stringify({ workspace: '' }),
          response: JSON.stringify({
            handoffs: [{ id: 'h-99', topic: 'Cross-interface handoff', activeStoryId: '' }],
            activeStories: [],
            activeRuns: [],
          }),
        },
      ],
    );

    expect(enriched[0]?.['threadId']).toBe(enriched[1]?.['threadId']);
    expect(enriched[0]?.['threadTitle']).toBe('Cross-interface handoff');
    expect(enriched[1]?.['threadTitle']).toBe('Cross-interface handoff');
  });

  it('should merge conversations that share a storyId or runId even without an explicit handoff', () => {
    const enriched = attachThreads(
      [
        { id: 'p-1', conversationId: 'conv-claude', tool: 'claude' },
        { id: 'p-2', conversationId: 'conv-agy', tool: 'antigravity' },
      ],
      [
        {
          promptId: 'p-1',
          request: JSON.stringify({ agent: 'devops', request: 'Check CI' }),
          response: JSON.stringify({ runId: 'run-42', status: 'working' }),
        },
        {
          promptId: 'p-2',
          request: JSON.stringify({ runId: 'run-42', handBack: { ok: true } }),
          response: JSON.stringify({ runId: 'run-42', status: 'finished' }),
        },
      ],
    );

    expect(enriched[0]?.['threadId']).toBe(enriched[1]?.['threadId']);
  });
});
