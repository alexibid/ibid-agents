import { describe, expect, it } from 'vitest';
import { eventsOf, flowDrawingOf, nameOf, NODE_GAP, NODE_WIDTH, type Flow, type Story } from './flow-map';

const node = (id: string, doneBy = 'langgraph') => ({ id, doneBy, task: '', contracts: [], contractsWhenNeeded: [] });
const edge = (source: string, target: string) => ({ source, target, conditional: true });

const flow: Flow = {
  id: 'story',
  title: 'User story',
  nodes: [node('__start__', 'assistant'), node('planning', 'project specialist'), node('implement', 'developer'), node('review', 'reviewer')],
  edges: [edge('__start__', 'planning'), edge('planning', 'implement'), edge('implement', 'review'), edge('review', 'implement'), edge('review', 'review'), edge('planning', 'review')],
};

const story: Story = {
  id: 'papikapi-1',
  project: 'papikapi',
  title: 'A story',
  status: 'working',
  startedOn: '2026-11-13T10:00:00.000Z',
  steps: [
    { step: 'plan', passed: true, attempt: 1, details: [], seconds: 3, occurredOn: '2026-11-13T10:01:00.000Z' },
    { step: 'review', passed: true, attempt: 1, details: [], seconds: 9, occurredOn: '2026-11-13T10:05:00.000Z' },
    { step: 'review', passed: false, attempt: 2, details: ['W09 broken'], seconds: 4, occurredOn: '2026-11-13T10:09:00.000Z' },
  ],
};

describe('flowDrawingOf', () => {
  it('should lay every node out from left to right, evenly spaced', () => {
    const drawing = flowDrawingOf(flow, undefined);

    expect(drawing.nodes.map((placed) => placed.x)).toEqual([0, 1, 2, 3].map((index) => 24 + index * (NODE_WIDTH + NODE_GAP)));
    expect(drawing.width).toBe(48 + 4 * NODE_WIDTH + 3 * NODE_GAP);
  });

  it('should draw the next step as forward and a step that goes back as a repair, never a step to itself', () => {
    const drawing = flowDrawingOf(flow, undefined);

    expect(drawing.forward.map((link) => link.id)).toEqual(['__start__>planning', 'planning>implement', 'implement>review']);
    expect(drawing.repairs.map((link) => link.id)).toEqual(['review>implement']);
  });

  it('should colour each node with the last result the story had there', () => {
    const states = flowDrawingOf(flow, story).nodes.map((placed) => placed.state);

    expect(states).toEqual(['untouched', 'passed', 'untouched', 'failed']);
  });

  it('should tell the steps LangGraph runs itself from the ones an agent does', () => {
    const drawing = flowDrawingOf({ ...flow, nodes: [node('build'), node('review', 'reviewer')] }, undefined);

    expect(drawing.nodes.map((placed) => placed.byLangGraph)).toEqual([true, false]);
  });
});

describe('eventsOf', () => {
  it('should find the events of the plan under the planning node', () => {
    expect(eventsOf('planning', story)).toHaveLength(1);
    expect(eventsOf('review', story).map((event) => event.attempt)).toEqual([1, 2]);
    expect(eventsOf('review', undefined)).toEqual([]);
  });
});

describe('nameOf', () => {
  it('should name a known node in Portuguese and keep an unknown one as it is', () => {
    expect(nameOf('final-verification')).toBe('Verificação final');
    expect(nameOf('new-step')).toBe('new-step');
  });
});
