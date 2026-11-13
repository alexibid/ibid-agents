import type { AgentKind, Tool } from './prompt';
import type { CatalogEntry, Origin } from './flow-map';

export interface RosterEntry {
  readonly agent: string;
  readonly kind: AgentKind;
  readonly calls: number;
  readonly failures: number;
  readonly lastOn: string;
}

export interface AgentRun {
  readonly id: string;
  readonly kind: AgentKind;
  readonly request: string;
  readonly response: string;
  readonly failed: boolean;
  readonly calledOn: string;
  readonly promptId: string;
  readonly tool: Tool;
  readonly promptText: string;
}

export type Group = Origin | 'tool';

export interface AgentGroup {
  readonly group: Group;
  readonly title: string;
  readonly agents: readonly KnownAgent[];
}

export interface KnownAgent {
  readonly group: Group;
  readonly name: string;
  readonly activityName: string;
  readonly kind: AgentKind;
  readonly job: string;
  readonly file: string;
  readonly inRepository: boolean;
  readonly calls: number;
  readonly failures: number;
  readonly lastOn: string;
  readonly command: string;
}

const NEVER = '';

export function knownAgentsOf(catalog: readonly CatalogEntry[], roster: readonly RosterEntry[]): KnownAgent[] {
  const ran = new Map(roster.map((entry) => [slugOf(entry.agent), entry]));
  const kept = catalog.map((entry) => {
    const slug = slugOf(entry.name);
    const activity = ran.get(slug);
    ran.delete(slug);
    return {
      group: entry.origin,
      name: entry.name,
      activityName: activity?.agent ?? slug,
      kind: entry.kind,
      job: entry.job,
      file: entry.file,
      inRepository: true,
      calls: activity?.calls ?? 0,
      failures: activity?.failures ?? 0,
      lastOn: activity?.lastOn ?? NEVER,
      command: `/${entry.name}`,
    };
  });
  const elsewhere = [...ran.values()].map((entry) => ({
    group: 'tool' as const,
    name: entry.agent,
    activityName: entry.agent,
    kind: entry.kind,
    job: '',
    file: '',
    inRepository: false,
    calls: entry.calls,
    failures: entry.failures,
    lastOn: entry.lastOn,
    command: '',
  }));
  return [...kept, ...elsewhere].sort(byMostRecentThenName);
}

const GROUPS: readonly (readonly [Group, string])[] = [
  ['mine', 'Os meus'],
  ['langgraph', 'Do LangGraph'],
  ['system', 'Do sistema'],
  ['tool', 'Das ferramentas (fora do ibid-agents)'],
];

export function groupedAgents(agents: readonly KnownAgent[]): AgentGroup[] {
  return GROUPS.flatMap(([group, title]) => {
    const members = agents.filter((agent) => agent.group === group);
    return members.length === 0 ? [] : [{ group, title, agents: members }];
  });
}

function byMostRecentThenName(first: KnownAgent, second: KnownAgent): number {
  return second.lastOn.localeCompare(first.lastOn) || first.name.localeCompare(second.name);
}

function slugOf(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_]+/g, '-');
}
