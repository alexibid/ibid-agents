import { describe, expect, it } from 'vitest';
import { groupedAgents, knownAgentsOf } from './agent-roster';
import type { CatalogEntry } from './flow-map';

const skill = (name: string, origin: CatalogEntry['origin'] = 'mine'): CatalogEntry => ({ file: `${name}/SKILL.md`, name, kind: 'skill', job: `${name} skill`, origin });
const contract = (_file: string, name: string): CatalogEntry => skill(name.toLowerCase().replace(/ /g, '-'), 'langgraph');

describe('knownAgentsOf', () => {
  it('should list every agent of the repository, with its activity when it ran', () => {
    const agents = knownAgentsOf(
      [contract('test-author.md', 'Test author'), skill('assistente')],
      [{ agent: 'assistente', kind: 'skill', calls: 4, failures: 1, lastOn: '2026-11-13T10:00:00.000Z' }],
    );

    expect(agents.map(({ name, calls, inRepository }) => ({ name, calls, inRepository }))).toEqual([
      { name: 'assistente', calls: 4, inRepository: true },
      { name: 'test-author', calls: 0, inRepository: true },
    ]);
  });

  it('should give every skill the command that invokes it in Claude and Antigravity', () => {
    const agents = knownAgentsOf([skill('coach'), contract('reviewer.md', 'Reviewer')], []);

    expect(agents.map(({ name, command }) => ({ name, command }))).toEqual([
      { name: 'coach', command: '/coach' },
      { name: 'reviewer', command: '/reviewer' },
    ]);
  });

  it('should group my skills, the LangGraph roles, the system skills and the tools own agents, in that order', () => {
    const agents = knownAgentsOf(
      [skill('nx-workspace', 'system'), skill('ev'), skill('reviewer', 'langgraph')],
      [{ agent: 'Explore', kind: 'agent', calls: 1, failures: 0, lastOn: '2026-11-13T10:00:00.000Z' }],
    );

    expect(groupedAgents(agents).map((group) => [group.title, group.agents.map((agent) => agent.name)])).toEqual([
      ['Os meus', ['ev']],
      ['Do LangGraph', ['reviewer']],
      ['Do sistema', ['nx-workspace']],
      ['Das ferramentas (fora do ibid-agents)', ['Explore']],
    ]);
  });

  it('should add the agents that ran but live outside the repository', () => {
    const agents = knownAgentsOf([], [{ agent: 'Explore', kind: 'agent', calls: 2, failures: 0, lastOn: '2026-11-12T10:00:00.000Z' }]);

    expect(agents).toEqual([expect.objectContaining({ name: 'Explore', activityName: 'Explore', inRepository: false, calls: 2 })]);
  });

  it('should put the most recently used first and the rest by name', () => {
    const agents = knownAgentsOf(
      [contract('reviewer.md', 'Reviewer'), contract('archivist.md', 'Archivist')],
      [
        { agent: 'web-fetch', kind: 'agent', calls: 1, failures: 0, lastOn: '2026-11-10T10:00:00.000Z' },
        { agent: 'reviewer', kind: 'agent', calls: 1, failures: 0, lastOn: '2026-11-13T10:00:00.000Z' },
      ],
    );

    expect(agents.map((agent) => agent.name)).toEqual(['reviewer', 'web-fetch', 'archivist']);
  });
});
