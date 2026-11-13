import type { AgentCall, AgentKind } from './prompt';

export interface Place {
  readonly x: number;
  readonly y: number;
}

export interface GraphNode extends Place {
  readonly agent: string;
  readonly kind: AgentKind;
  readonly calls: number;
  readonly failed: boolean;
}

export interface GraphGroup extends Place {
  readonly kind: AgentKind;
  readonly label: string;
  readonly failed: boolean;
}

export interface GraphLink {
  readonly id: string;
  readonly path: string;
  readonly failed: boolean;
}

export interface AgentGraph {
  readonly width: number;
  readonly height: number;
  readonly centre: Place & { readonly calls: number };
  readonly groups: readonly GraphGroup[];
  readonly agents: readonly GraphNode[];
  readonly links: readonly GraphLink[];
}

export const ASSISTANT = 'Assistente';
export const CENTRE_HALF_WIDTH = 70;
export const GROUP_HALF_WIDTH = 66;
export const NODE_HALF_WIDTH = 92;

const WIDTH = 760;
const ROW = 64;
const PADDING = 24;
const CENTRE_X = 90;
const GROUP_X = 320;
const NODE_X = WIDTH - NODE_HALF_WIDTH - 16;
const ORDER: readonly AgentKind[] = ['langgraph', 'agent', 'skill', 'tool'];
const GROUP_LABELS: Readonly<Record<AgentKind, string>> = {
  langgraph: 'LangGraph',
  agent: 'Agentes',
  skill: 'Skills',
  tool: 'Ferramentas',
};

export function agentGraphOf(calls: readonly AgentCall[]): AgentGraph {
  const agents = placedAgents(calls);
  const height = Math.max(agents.length, 1) * ROW + PADDING * 2;
  const centre = { x: CENTRE_X, y: height / 2, calls: calls.length };
  const groups = ORDER.flatMap((kind) => groupOf(kind, agents));
  return { width: WIDTH, height, centre, groups, agents, links: linksOf(centre, groups, agents) };
}

export function callsTo(agent: string, calls: readonly AgentCall[]): AgentCall[] {
  return calls.filter((call) => call.agent === agent);
}

function placedAgents(calls: readonly AgentCall[]): GraphNode[] {
  const grouped = new Map<string, AgentCall[]>();
  for (const call of calls) {
    grouped.set(call.agent, [...(grouped.get(call.agent) ?? []), call]);
  }
  const ordered = [...grouped.entries()].sort(([, first], [, second]) => rankOf(first) - rankOf(second));
  return ordered.map(([agent, agentCalls], row) => ({
    agent,
    kind: agentCalls[0]?.kind ?? 'tool',
    calls: agentCalls.length,
    failed: agentCalls.some((call) => call.failed),
    x: NODE_X,
    y: PADDING + ROW / 2 + row * ROW,
  }));
}

function groupOf(kind: AgentKind, agents: readonly GraphNode[]): GraphGroup[] {
  const members = agents.filter((node) => node.kind === kind);
  if (members.length === 0) {
    return [];
  }
  const y = members.reduce((total, node) => total + node.y, 0) / members.length;
  return [{ kind, label: GROUP_LABELS[kind], failed: members.some((node) => node.failed), x: GROUP_X, y }];
}

function linksOf(centre: Place, groups: readonly GraphGroup[], agents: readonly GraphNode[]): GraphLink[] {
  const toGroups = groups.map((group) => ({
    id: `group:${group.kind}`,
    path: curve({ x: centre.x + CENTRE_HALF_WIDTH, y: centre.y }, { x: group.x - GROUP_HALF_WIDTH, y: group.y }),
    failed: group.failed,
  }));
  const toAgents = agents.map((node) => ({
    id: `agent:${node.agent}`,
    path: curve({ x: GROUP_X + GROUP_HALF_WIDTH, y: groups.find((group) => group.kind === node.kind)?.y ?? node.y }, {
      x: node.x - NODE_HALF_WIDTH,
      y: node.y,
    }),
    failed: node.failed,
  }));
  return [...toGroups, ...toAgents];
}

function curve(from: Place, to: Place): string {
  const middle = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${middle} ${from.y}, ${middle} ${to.y}, ${to.x} ${to.y}`;
}

function rankOf(calls: readonly AgentCall[]): number {
  return ORDER.indexOf(calls[0]?.kind ?? 'tool');
}
