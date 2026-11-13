import { join, resolve } from 'node:path';
import { buildCoachGraph } from '../coach/graph.js';
import { isStepName } from '../domain/steps.js';
import { buildFlowGraph } from '../flow/graph.js';
import { describedStep } from '../flow/instructions.js';
import { SheetReader } from '../sheets/sheet-reader.js';
import { agentsIn, skillsIn, type CatalogEntry, type Origin } from './catalog.js';

export interface FlowNode {
  readonly id: string;
  readonly doneBy: string;
  readonly task: string;
  readonly contracts: readonly string[];
  readonly contractsWhenNeeded: readonly string[];
}

export interface Flow {
  readonly id: string;
  readonly title: string;
  readonly nodes: readonly FlowNode[];
  readonly edges: readonly { readonly source: string; readonly target: string; readonly conditional: boolean }[];
}

export interface FlowMap {
  readonly flows: readonly Flow[];
  readonly agents: readonly CatalogEntry[];
  readonly skills: readonly CatalogEntry[];
}

const AGENTS_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const CONTRACTS = join(AGENTS_ROOT, 'agents');
const SKILLS = join(AGENTS_ROOT, 'skills');
const SYSTEM_SKILLS = join(AGENTS_ROOT, 'system-skills');
const SHEETS = join(AGENTS_ROOT, 'rules', 'projects');
const COACH_CONTRACT = 'coach.md';
const LANGGRAPH_SKILLS: ReadonlySet<string> = new Set(['assistente']);

const BOUNDARIES: Readonly<Record<string, FlowNode>> = {
  __start__: { id: '__start__', doneBy: 'assistant', task: 'The assistant starts a story the user approved.', contracts: [], contractsWhenNeeded: [] },
  __end__: { id: '__end__', doneBy: 'user', task: 'The user reviews the code and commits it.', contracts: [], contractsWhenNeeded: [] },
  intake: { id: 'intake', doneBy: 'langgraph', task: 'LangGraph reads the project sheet and notes the state of the workspace.', contracts: [], contractsWhenNeeded: [] },
};

const COACH_TASKS: Readonly<Record<string, string>> = {
  'design-outside-in': 'Design the lesson from the outside in: what the student will see before how it is built.',
  'author-lesson': 'Write one bite-sized lesson block for the student.',
  'await-student': 'Wait for the student code and verify it.',
};

export async function flowMapOf(): Promise<FlowMap> {
  const story = buildFlowGraph({ workspaceRoot: '', sheets: new SheetReader(SHEETS), contractsDirectory: CONTRACTS });
  const coach = buildCoachGraph({ contractsDirectory: CONTRACTS });
  const contractNames = new Set((await agentsIn(CONTRACTS)).map((entry) => entry.file.replace(/\.md$/, '')));
  const [storyDrawing, coachDrawing, agents, [ownSkills, systemSkills]] = await Promise.all([
    story.getGraphAsync(),
    coach.getGraphAsync(),
    agentsIn(CONTRACTS),
    Promise.all([skillsIn(SKILLS, (name) => originOfOwnSkill(name, contractNames)), skillsIn(SYSTEM_SKILLS, () => 'system')]),
  ]);
  return {
    flows: [
      { id: 'story', title: 'User story', nodes: Object.keys(storyDrawing.nodes).map(storyNode), edges: storyDrawing.edges.map(edgeOf) },
      { id: 'coach', title: 'Coach', nodes: Object.keys(coachDrawing.nodes).map(coachNode), edges: coachDrawing.edges.map(edgeOf) },
    ],
    agents,
    skills: [...ownSkills, ...systemSkills],
  };
}

function originOfOwnSkill(name: string, contractNames: ReadonlySet<string>): Origin {
  return contractNames.has(name) || LANGGRAPH_SKILLS.has(name) ? 'langgraph' : 'mine';
}

function storyNode(id: string): FlowNode {
  const boundary = BOUNDARIES[id];
  if (boundary !== undefined) {
    return boundary;
  }
  const step = id === 'planning' ? 'plan' : isStepName(id) ? id : undefined;
  return step === undefined ? { ...emptyNode(id) } : { id, ...describedStep(step) };
}

function coachNode(id: string): FlowNode {
  const boundary = BOUNDARIES[id];
  if (boundary !== undefined) {
    return boundary;
  }
  const task = COACH_TASKS[id];
  return task === undefined ? emptyNode(id) : { id, doneBy: 'coach', task, contracts: [COACH_CONTRACT], contractsWhenNeeded: [] };
}

function emptyNode(id: string): FlowNode {
  return { id, doneBy: 'langgraph', task: '', contracts: [], contractsWhenNeeded: [] };
}

function edgeOf(edge: { readonly source: string; readonly target: string; readonly conditional?: boolean }) {
  return { source: edge.source, target: edge.target, conditional: edge.conditional === true };
}
