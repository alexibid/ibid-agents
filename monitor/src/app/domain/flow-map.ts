export interface FlowNode {
  readonly id: string;
  readonly doneBy: string;
  readonly task: string;
  readonly contracts: readonly string[];
  readonly contractsWhenNeeded: readonly string[];
}

export interface FlowEdge {
  readonly source: string;
  readonly target: string;
  readonly conditional: boolean;
}

export interface Flow {
  readonly id: string;
  readonly title: string;
  readonly nodes: readonly FlowNode[];
  readonly edges: readonly FlowEdge[];
}

export type Origin = 'mine' | 'langgraph' | 'system';

export interface CatalogEntry {
  readonly file: string;
  readonly name: string;
  readonly kind: 'agent' | 'skill';
  readonly job: string;
  readonly origin: Origin;
}

export interface FlowMap {
  readonly flows: readonly Flow[];
  readonly agents: readonly CatalogEntry[];
  readonly skills: readonly CatalogEntry[];
}

export interface StoryStep {
  readonly step: string;
  readonly passed: boolean;
  readonly attempt: number;
  readonly details: readonly string[];
  readonly seconds: number;
  readonly occurredOn: string;
}

export interface Story {
  readonly id: string;
  readonly project: string;
  readonly title: string;
  readonly status: string;
  readonly startedOn: string;
  readonly steps: readonly StoryStep[];
}

export type NodeState = 'passed' | 'failed' | 'untouched';

export interface PlacedNode extends FlowNode {
  readonly x: number;
  readonly state: NodeState;
  readonly byLangGraph: boolean;
}

export interface FlowDrawing {
  readonly width: number;
  readonly nodes: readonly PlacedNode[];
  readonly forward: readonly { readonly id: string; readonly from: number; readonly to: number }[];
  readonly repairs: readonly { readonly id: string; readonly from: number; readonly to: number }[];
}

export const EMPTY_FLOW_MAP: FlowMap = { flows: [], agents: [], skills: [] };
export const NODE_WIDTH = 150;
export const NODE_GAP = 54;
export const MARGIN = 24;

const RUN_BY_LANGGRAPH = new Set(['langgraph']);
const EVENT_OF_NODE: Readonly<Record<string, string>> = { planning: 'plan' };

export const NODE_NAMES: Readonly<Record<string, string>> = {
  __start__: 'Início',
  __end__: 'Fim',
  intake: 'Receber',
  planning: 'Plano',
  'author-tests': 'Escrever testes',
  implement: 'Implementar',
  build: 'Build',
  lint: 'Lint',
  'rule-checks': 'Regras',
  'unit-tests': 'Testes unitários',
  'validate-tests': 'Validar testes',
  journey: 'Jornada',
  'browser-qa': 'QA no browser',
  accessibility: 'Acessibilidade',
  performance: 'Performance',
  'ux-critique': 'Crítica de UX',
  'visual-gate': 'Gate visual',
  review: 'Revisão',
  'final-verification': 'Verificação final',
  'design-outside-in': 'Desenhar a lição',
  'author-lesson': 'Escrever a lição',
  'await-student': 'Esperar o aluno',
};

export function flowDrawingOf(flow: Flow, story: Story | undefined): FlowDrawing {
  const positions = new Map(flow.nodes.map((node, index) => [node.id, index]));
  const nodes = flow.nodes.map((node, index) => ({
    ...node,
    x: MARGIN + index * (NODE_WIDTH + NODE_GAP),
    state: stateOf(node.id, story),
    byLangGraph: RUN_BY_LANGGRAPH.has(node.doneBy),
  }));
  const linked = flow.edges.flatMap((edge) => {
    const from = positions.get(edge.source);
    const to = positions.get(edge.target);
    return from === undefined || to === undefined || from === to ? [] : [{ id: `${edge.source}>${edge.target}`, from, to }];
  });
  return {
    width: MARGIN * 2 + flow.nodes.length * NODE_WIDTH + (flow.nodes.length - 1) * NODE_GAP,
    nodes,
    forward: linked.filter((link) => link.to === link.from + 1),
    repairs: linked.filter((link) => link.to < link.from),
  };
}

export function eventsOf(nodeId: string, story: Story | undefined): StoryStep[] {
  const event = EVENT_OF_NODE[nodeId] ?? nodeId;
  return (story?.steps ?? []).filter((step) => step.step === event);
}

export function nameOf(nodeId: string): string {
  return NODE_NAMES[nodeId] ?? nodeId;
}

function stateOf(nodeId: string, story: Story | undefined): NodeState {
  const last = eventsOf(nodeId, story).at(-1);
  if (last === undefined) {
    return 'untouched';
  }
  return last.passed ? 'passed' : 'failed';
}
