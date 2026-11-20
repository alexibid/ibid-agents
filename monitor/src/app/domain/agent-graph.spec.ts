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
  calledBy: '',
  ...fields,
});

describe('agentGraphOf', () => {
  it('should draw the assistant alone when nothing was called', () => {
    const graph = agentGraphOf([]);

    expect(graph.agents).toEqual([]);
    expect(graph.links).toEqual([]);
    expect(graph.centre.calls).toBe(0);
  });

  it('should draw one node per thing called, agents before tools', () => {
    const graph = agentGraphOf([
      call('1', 'Bash', { kind: 'tool' }),
      call('2', 'specialist'),
      call('3', 'developer'),
      call('4', 'specialist'),
    ]);

    expect(graph.agents.map(({ agent, kind, calls }) => ({ agent, kind, calls }))).toEqual([
      { agent: 'specialist', kind: 'agent', calls: 2 },
      { agent: 'developer', kind: 'agent', calls: 1 },
      { agent: 'Bash', kind: 'tool', calls: 1 },
    ]);
    expect(graph.centre.calls).toBe(4);
  });

  it('should never draw LangGraph, which is software and not something the assistant delegates to', () => {
    const graph = agentGraphOf([
      call('1', 'LangGraph', { kind: 'langgraph' }),
      call('2', 'specialist'),
      call('3', 'LangGraph', { kind: 'langgraph' }),
    ]);

    expect(graph.agents.map(({ agent }) => agent)).toEqual(['specialist']);
    expect(graph.centre.calls).toBe(1);
  });

  it('should read from left to right: assistant, then what it called, with no grouping nodes', () => {
    const graph = agentGraphOf([call('1', 'Explore'), call('2', 'Bash', { kind: 'tool' })]);

    for (const node of graph.agents) {
      expect(node.x).toBeGreaterThan(graph.centre.x);
    }
    expect(Object.keys(graph)).not.toContain('groups');
  });

  it('should mark a node as failed when any of its calls failed', () => {
    const graph = agentGraphOf([call('1', 'Explore'), call('2', 'Explore', { failed: true }), call('3', 'reviewer')]);

    expect(graph.agents.map((node) => node.failed)).toEqual([true, false]);
  });

  it('should link the assistant straight to each thing it called', () => {
    const graph = agentGraphOf([call('1', 'Explore'), call('2', 'Bash', { kind: 'tool' }), call('3', 'Read', { kind: 'tool' })]);

    expect(graph.links.map((link) => link.id)).toEqual(['agent:Explore', 'agent:Bash', 'agent:Read']);
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

describe('agent tools', () => {
  const calls = [
    call('lg', 'LangGraph', { kind: 'langgraph' }),
    call('ag1', 'specialist'),
    call('ag2', 'developer'),
    call('t1', 'Bash', { kind: 'tool', calledBy: 'ag1' }),
    call('t2', 'Read', { kind: 'tool', calledBy: 'ag1' }),
    call('t3', 'Bash', { kind: 'tool', calledBy: 'ag1' }),
    call('t4', 'Edit', { kind: 'tool', calledBy: 'ag2' }),
    call('t5', 'Read', { kind: 'tool' }),
  ];

  it('should draw the tools an agent used beside that agent, not beside the assistant', () => {
    const graph = agentGraphOf(calls);

    expect(graph.agents.map(({ key, calls: count }) => ({ key, count }))).toEqual([
      { key: 'specialist', count: 1 },
      { key: 'developer', count: 1 },
      { key: 'Read', count: 1 },
    ]);
    expect(graph.agentTools.map(({ key, calls: count }) => ({ key, count }))).toEqual([
      { key: 'specialist › Bash', count: 2 },
      { key: 'specialist › Read', count: 1 },
      { key: 'developer › Edit', count: 1 },
    ]);
    expect(graph.centre.calls).toBe(3);
  });

  it('should draw assistant, then agent, then the tools of that agent', () => {
    const graph = agentGraphOf(calls);

    expect(graph.links.map(({ id }) => id)).toEqual([
      'agent:specialist',
      'agent:developer',
      'agent:Read',
      'tool:specialist › Bash',
      'tool:specialist › Read',
      'tool:developer › Edit',
    ]);
  });

  it('should place each agent tool to the right of its agent, inside the drawing', () => {
    const graph = agentGraphOf(calls);
    const specialist = graph.agents.find(({ key }) => key === 'specialist');

    for (const tool of graph.agentTools) {
      expect(tool.x).toBeGreaterThan(specialist?.x ?? 0);
      expect(tool.x).toBeLessThan(graph.width);
      expect(tool.y).toBeLessThan(graph.height);
    }
    expect(graph.links.map(({ id }) => id)).toContain('tool:specialist › Bash');
  });

  it('should open the calls an agent made to a tool, apart from the assistant own calls to it', () => {
    expect(callsTo('specialist › Bash', calls).map(({ id }) => id)).toEqual(['t1', 't3']);
    expect(callsTo('Read', calls).map(({ id }) => id)).toEqual(['t5']);
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
