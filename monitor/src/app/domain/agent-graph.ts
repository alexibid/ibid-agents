import { CALLED_BY_ASSISTANT, type AgentCall, type AgentKind } from './prompt';

export interface Place {
  readonly x: number;
  readonly y: number;
}

export interface GraphNode extends Place {
  readonly key: string;
  readonly agent: string;
  readonly kind: AgentKind;
  readonly calls: number;
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
  readonly agents: readonly GraphNode[];
  readonly agentTools: readonly GraphNode[];
  readonly links: readonly GraphLink[];
}

export const ASSISTANT = 'Assistente';
export const CENTRE_HALF_WIDTH = 70;
export const NODE_HALF_WIDTH = 92;
export const TOOL_HALF_WIDTH = 80;

type DrawnKind = Exclude<AgentKind, 'langgraph'>;

const ROW = 64;
const PADDING = 24;
const CENTRE_X = 90;
const NODE_X = 330;
const TOOL_X = NODE_X + NODE_HALF_WIDTH + 70 + TOOL_HALF_WIDTH;
const WIDTH_WITHOUT_AGENT_TOOLS = NODE_X + NODE_HALF_WIDTH + 16;
const WIDTH_WITH_AGENT_TOOLS = TOOL_X + TOOL_HALF_WIDTH + 16;
const USED_BY = ' › ';
const ORDER: readonly DrawnKind[] = ['agent', 'skill', 'tool'];

interface CalledThing {
  readonly agent: string;
  readonly calls: readonly AgentCall[];
  readonly tools: readonly CalledThing[];
}

export function agentGraphOf(allCalls: readonly AgentCall[]): AgentGraph {
  const calls = delegatedCalls(allCalls);
  const things = calledThingsOf(calls);
  const rows = things.reduce((total, thing) => total + rowsOf(thing), 0);
  const height = Math.max(rows, 1) * ROW + PADDING * 2;
  const { agents, agentTools } = placed(things);
  const centre = { x: CENTRE_X, y: height / 2, calls: things.reduce((total, thing) => total + thing.calls.length, 0) };
  const width = agentTools.length > 0 ? WIDTH_WITH_AGENT_TOOLS : WIDTH_WITHOUT_AGENT_TOOLS;
  return { width, height, centre, agents, agentTools, links: linksOf(centre, agents, agentTools) };
}

export function delegatedCalls(calls: readonly AgentCall[]): AgentCall[] {
  return calls.filter((call) => call.kind !== 'langgraph');
}

export function callsTo(key: string, calls: readonly AgentCall[]): AgentCall[] {
  const [caller, tool] = key.split(USED_BY);
  if (caller === undefined || tool === undefined) {
    return calls.filter((call) => call.agent === key && call.calledBy === CALLED_BY_ASSISTANT);
  }
  const callerIds = new Set(calls.filter((call) => call.agent === caller).map((call) => call.id));
  return calls.filter((call) => call.agent === tool && callerIds.has(call.calledBy));
}

function calledThingsOf(calls: readonly AgentCall[]): CalledThing[] {
  const own = calls.filter((call) => call.calledBy === CALLED_BY_ASSISTANT);
  return groupedByName(own)
    .map(([agent, agentCalls]) => ({ agent, calls: agentCalls, tools: toolsOf(agentCalls, calls) }))
    .sort((first, second) => rankOf(first.calls) - rankOf(second.calls));
}

function toolsOf(agentCalls: readonly AgentCall[], calls: readonly AgentCall[]): CalledThing[] {
  const ids = new Set(agentCalls.map((call) => call.id));
  const used = calls.filter((call) => ids.has(call.calledBy));
  return groupedByName(used).map(([agent, toolCalls]) => ({ agent, calls: toolCalls, tools: [] }));
}

function groupedByName(calls: readonly AgentCall[]): [string, AgentCall[]][] {
  const grouped = new Map<string, AgentCall[]>();
  for (const call of calls) {
    grouped.set(call.agent, [...(grouped.get(call.agent) ?? []), call]);
  }
  return [...grouped.entries()];
}

function rowsOf(thing: CalledThing): number {
  return Math.max(thing.tools.length, 1);
}

function placed(things: readonly CalledThing[]): { agents: GraphNode[]; agentTools: GraphNode[] } {
  const agents: GraphNode[] = [];
  const agentTools: GraphNode[] = [];
  let row = 0;
  for (const thing of things) {
    const top = PADDING + ROW / 2 + row * ROW;
    agents.push(nodeOf(thing, thing.agent, { x: NODE_X, y: top + ((rowsOf(thing) - 1) * ROW) / 2 }));
    thing.tools.forEach((tool, index) =>
      agentTools.push(nodeOf(tool, `${thing.agent}${USED_BY}${tool.agent}`, { x: TOOL_X, y: top + index * ROW })),
    );
    row += rowsOf(thing);
  }
  return { agents, agentTools };
}

function nodeOf(thing: CalledThing, key: string, place: Place): GraphNode {
  return {
    key,
    agent: thing.agent,
    kind: thing.calls[0]?.kind ?? 'tool',
    calls: thing.calls.length,
    failed: thing.calls.some((call) => call.failed),
    ...place,
  };
}

function linksOf(centre: Place, agents: readonly GraphNode[], agentTools: readonly GraphNode[]): GraphLink[] {
  const toAgents = agents.map((node) => ({
    id: `agent:${node.key}`,
    path: curve({ x: centre.x + CENTRE_HALF_WIDTH, y: centre.y }, { x: node.x - NODE_HALF_WIDTH, y: node.y }),
    failed: node.failed,
  }));
  const toTools = agentTools.map((tool) => {
    const caller = agents.find((node) => tool.key.startsWith(`${node.agent}${USED_BY}`));
    return {
      id: `tool:${tool.key}`,
      path: curve({ x: NODE_X + NODE_HALF_WIDTH, y: caller?.y ?? tool.y }, { x: tool.x - TOOL_HALF_WIDTH, y: tool.y }),
      failed: tool.failed,
    };
  });
  return [...toAgents, ...toTools];
}

function curve(from: Place, to: Place): string {
  const middle = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${middle} ${from.y}, ${middle} ${to.y}, ${to.x} ${to.y}`;
}

function rankOf(calls: readonly AgentCall[]): number {
  const kind = calls[0]?.kind ?? 'tool';
  return ORDER.findIndex((drawn) => drawn === kind);
}
