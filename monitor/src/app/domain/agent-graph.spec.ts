import { describe, expect, it } from 'vitest';
import { agentGraphOf, callsTo } from './agent-graph';
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
  it('should draw the assistant alone when nothing was called', () => {
    const graph = agentGraphOf([]);

    expect(graph.agents).toEqual([]);
    expect(graph.groups).toEqual([]);
    expect(graph.centre.calls).toBe(0);
  });

  it('should draw one node per thing called, LangGraph and agents before tools', () => {
    const graph = agentGraphOf([
      call('1', 'Bash', { kind: 'tool' }),
      call('2', 'Explore'),
      call('3', 'LangGraph', { kind: 'langgraph' }),
      call('4', 'Explore'),
    ]);

    expect(graph.agents.map(({ agent, kind, calls }) => ({ agent, kind, calls }))).toEqual([
      { agent: 'LangGraph', kind: 'langgraph', calls: 1 },
      { agent: 'Explore', kind: 'agent', calls: 2 },
      { agent: 'Bash', kind: 'tool', calls: 1 },
    ]);
    expect(graph.groups.map((group) => group.label)).toEqual(['LangGraph', 'Agentes', 'Ferramentas']);
    expect(graph.centre.calls).toBe(4);
  });

  it('should read from left to right: assistant, then groups, then what was called', () => {
    const graph = agentGraphOf([call('1', 'Explore'), call('2', 'Bash', { kind: 'tool' })]);

    for (const group of graph.groups) {
      expect(group.x).toBeGreaterThan(graph.centre.x);
    }
    for (const node of graph.agents) {
      expect(node.x).toBeGreaterThan(graph.groups[0]?.x ?? 0);
    }
  });

  it('should mark a node and its group as failed when any call failed', () => {
    const graph = agentGraphOf([call('1', 'Explore'), call('2', 'Explore', { failed: true }), call('3', 'reviewer')]);

    expect(graph.agents.map((node) => node.failed)).toEqual([true, false]);
    expect(graph.groups[0]?.failed).toBe(true);
  });

  it('should link the assistant to each group and each group to its members', () => {
    const graph = agentGraphOf([call('1', 'Explore'), call('2', 'Bash', { kind: 'tool' }), call('3', 'Read', { kind: 'tool' })]);

    expect(graph.links.map((link) => link.id)).toEqual(['group:agent', 'group:tool', 'agent:Explore', 'agent:Bash', 'agent:Read']);
  });

  it('should keep every node inside the drawing, one per row', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    const graph = agentGraphOf(names.map((agent) => call(agent, agent)));
    const rows = new Set(graph.agents.map((node) => node.y));

    expect(rows.size).toBe(names.length);
    for (const node of graph.agents) {
      expect(node.y).toBeGreaterThan(0);
      expect(node.y).toBeLessThan(graph.height);
      expect(node.x).toBeLessThan(graph.width);
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
