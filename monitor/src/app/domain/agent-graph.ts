import type { AgentCall, AgentKind } from './prompt';

export interface GraphNode {
  readonly agent: string;
  readonly kind: AgentKind | 'assistant';
  readonly calls: number;
  readonly failed: boolean;
  readonly x: number;
  readonly y: number;
}

export interface AgentGraph {
  readonly width: number;
  readonly height: number;
  readonly centre: GraphNode;
  readonly agents: readonly GraphNode[];
}

const WIDTH = 720;
const HEIGHT = 380;
const HORIZONTAL_REACH = 270;
const VERTICAL_REACH = 135;
const FULL_TURN = Math.PI * 2;
const STARTS_AT_TOP = -Math.PI / 2;

export const ASSISTANT = 'Assistente';

export function agentGraphOf(calls: readonly AgentCall[]): AgentGraph {
  const centre: GraphNode = { agent: ASSISTANT, kind: 'assistant', calls: calls.length, failed: false, x: WIDTH / 2, y: HEIGHT / 2 };
  const invoked = [...callsByAgent(calls).entries()];
  const agents = invoked.map(([agent, agentCalls], position) => {
    const angle = STARTS_AT_TOP + (FULL_TURN * position) / invoked.length;
    return {
      agent,
      kind: agentCalls[0]?.kind ?? 'agent',
      calls: agentCalls.length,
      failed: agentCalls.some((call) => call.failed),
      x: Math.round(centre.x + Math.cos(angle) * HORIZONTAL_REACH),
      y: Math.round(centre.y + Math.sin(angle) * VERTICAL_REACH),
    };
  });
  return { width: WIDTH, height: HEIGHT, centre, agents };
}

export function callsTo(agent: string, calls: readonly AgentCall[]): AgentCall[] {
  return calls.filter((call) => call.agent === agent);
}

function callsByAgent(calls: readonly AgentCall[]): Map<string, AgentCall[]> {
  const grouped = new Map<string, AgentCall[]>();
  for (const call of calls) {
    grouped.set(call.agent, [...(grouped.get(call.agent) ?? []), call]);
  }
  return grouped;
}
