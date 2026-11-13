import { describe, expect, it } from 'vitest';
import { agentGraphOf, ASSISTANT, callsTo } from './agent-graph';
import type { AgentCall } from './prompt';
import { secondsTakenBy, tokensSpentOn } from './prompt';

const call = (id: string, agent: string, fields: Partial<AgentCall> = {}): AgentCall => ({
  id,
  agent,
  kind: 'agent',
  request: 'request',
  response: 'response',
  failed: false,
  calledOn: '2026-11-13T10:00:00.000Z',
  ...fields,
});

describe('agentGraphOf', () => {
  it('should draw the assistant alone when no agent was invoked', () => {
    const graph = agentGraphOf([]);

    expect(graph.agents).toEqual([]);
    expect(graph.centre).toMatchObject({ agent: ASSISTANT, kind: 'assistant', calls: 0 });
  });

  it('should draw one node per invoked agent, with how often it was called', () => {
    const graph = agentGraphOf([
      call('1', 'Explore'),
      call('2', 'LangGraph', { kind: 'langgraph' }),
      call('3', 'Explore'),
    ]);

    expect(graph.agents.map(({ agent, kind, calls }) => ({ agent, kind, calls }))).toEqual([
      { agent: 'Explore', kind: 'agent', calls: 2 },
      { agent: 'LangGraph', kind: 'langgraph', calls: 1 },
    ]);
    expect(graph.centre.calls).toBe(3);
  });

  it('should mark an agent as failed when any of its calls failed', () => {
    const graph = agentGraphOf([call('1', 'Explore'), call('2', 'Explore', { failed: true }), call('3', 'reviewer')]);

    expect(graph.agents.map((node) => node.failed)).toEqual([true, false]);
  });

  it('should keep every node inside the drawing and apart from the others', () => {
    const graph = agentGraphOf(['a', 'b', 'c', 'd', 'e'].map((agent) => call(agent, agent)));
    const places = new Set(graph.agents.map((node) => `${node.x}:${node.y}`));

    expect(places.size).toBe(5);
    for (const node of graph.agents) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.x).toBeLessThan(graph.width);
      expect(node.y).toBeGreaterThan(0);
      expect(node.y).toBeLessThan(graph.height);
    }
  });
});

describe('callsTo', () => {
  it('should return only the calls made to that agent, in order', () => {
    const calls = [call('1', 'Explore'), call('2', 'reviewer'), call('3', 'Explore')];

    expect(callsTo('Explore', calls).map((entry) => entry.id)).toEqual(['1', '3']);
  });
});

describe('tokensSpentOn', () => {
  it('should add what was sent, what was written and what was stored, leaving out what was reused', () => {
    expect(tokensSpentOn({ inputTokens: 10, outputTokens: 200, cacheWriteTokens: 3000 })).toBe(3210);
  });
});

describe('secondsTakenBy', () => {
  it.each([
    ['2026-11-13T10:00:00.000Z', '2026-11-13T10:01:14.400Z', 74],
    ['2026-11-13T10:00:00.000Z', '2026-11-13T10:00:00.000Z', 0],
    ['2026-11-13T10:00:05.000Z', '2026-11-13T10:00:00.000Z', 0],
  ])('should measure a prompt asked at %s and finished at %s as %d seconds', (askedOn, finishedOn, seconds) => {
    expect(secondsTakenBy({ askedOn, finishedOn })).toBe(seconds);
  });
});
