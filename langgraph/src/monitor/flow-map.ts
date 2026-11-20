import { join, resolve } from 'node:path';
import { agentFlowsIn, type AgentFlowDefinition } from '../agent-runs/definition.js';
import { buildAgentRunGraph } from '../agent-runs/graph.js';
import { changeTrackerOf } from '../checks/workspace-changes.js';
import { NO_OTHER_STORIES } from '../domain/concurrent-stories.js';
import { buildCoachGraph } from '../coach/graph.js';
import { isStepName } from '../domain/steps.js';
import { buildFlowGraph } from '../flow/graph.js';
import { describedStep } from '../flow/instructions.js';
import { SheetReader } from '../sheets/sheet-reader.js';
import { agentsIn, projectSkillsIn, skillsIn, type CatalogEntry, type Origin } from './catalog.js';

export interface FlowNode {
  readonly id: string;
  readonly name?: string;
  readonly doneBy: string;
  readonly task: string;
  readonly contracts: readonly string[];
  readonly contractsWhenNeeded: readonly string[];
  readonly calls?: readonly string[];
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
const PROJECTS = join(AGENTS_ROOT, 'projects');
const SHEETS = join(AGENTS_ROOT, 'rules', 'projects');
const COACH_CONTRACT = 'coach.md';
const FLOW_ENGINE = 'Flow engine';
const USER = 'user';
const START_NODE = '__start__';
const ENGINE_SKILLS: ReadonlySet<string> = new Set(['assistant']);

const BOUNDARIES: Readonly<Record<string, FlowNode>> = {
  __start__: { id: '__start__', doneBy: '/assistant', task: 'The assistant starts a story the user approved.', contracts: [], contractsWhenNeeded: [] },
  __end__: { id: '__end__', doneBy: 'tu', task: 'The user reviews the code and commits it.', contracts: [], contractsWhenNeeded: [] },
  intake: { id: 'intake', doneBy: FLOW_ENGINE, task: 'The flow engine reads the project sheet and notes the state of the workspace.', contracts: [], contractsWhenNeeded: [] },
};

const COACH_TASKS: Readonly<Record<string, string>> = {
  'design-outside-in': 'Design the lesson from the outside in: what the student will see before how it is built.',
  'author-lesson': 'Write one bite-sized lesson block for the student.',
  'await-student': 'Wait for the student code and verify it.',
};

export async function flowMapOf(): Promise<FlowMap> {
  const sheets = new SheetReader(SHEETS);
  const story = buildFlowGraph({ workspaceRoot: '', sheets, contractsDirectory: CONTRACTS, changesOf: changeTrackerOf(''),
    activeStories: NO_OTHER_STORIES,
  });
  const coach = buildCoachGraph({ contractsDirectory: CONTRACTS });
  const contractNames = new Set((await agentsIn(CONTRACTS)).map((entry) => entry.file.replace(/\.md$/, '')));
  const [storyDrawing, coachDrawing, agents, [ownSkills, systemSkills, projectSkills]] = await Promise.all([
    story.getGraphAsync(),
    coach.getGraphAsync(),
    agentsIn(CONTRACTS),
    Promise.all([skillsIn(SKILLS, (name) => originOfOwnSkill(name, contractNames)), skillsIn(SYSTEM_SKILLS, () => 'system'), projectSkillsIn(PROJECTS, SYSTEM_SKILLS)]),
  ]);
  return {
    flows: [
      ...(await agentFlows()),
      { id: 'story', title: 'User story', nodes: Object.keys(storyDrawing.nodes).map(storyNode), edges: storyDrawing.edges.map(edgeOf) },
      { id: 'coach', title: 'Coach', nodes: Object.keys(coachDrawing.nodes).map(coachNode), edges: coachDrawing.edges.map(edgeOf) },
    ],
    agents,
    skills: [...ownSkills, ...systemSkills, ...projectSkills],
  };
}

async function agentFlows(): Promise<Flow[]> {
  const definitions = await agentFlowsIn(SKILLS);
  return Promise.all(definitions.map(agentFlowOf));
}

async function agentFlowOf(definition: AgentFlowDefinition): Promise<Flow> {
  const drawing = await buildAgentRunGraph(definition).getGraphAsync();
  const steps = new Map(definition.steps.map((step) => [step.id, step]));
  const nodes = Object.keys(drawing.nodes).map((id) => {
    const step = steps.get(id);
    return step === undefined
      ? id === START_NODE
        ? { id, doneBy: 'tu', task: `You invoke /${definition.agent} in Claude or Antigravity.`, contracts: [], contractsWhenNeeded: [] }
        : (BOUNDARIES[id] ?? emptyNode(id))
      : {
          id,
          name: step.name,
          doneBy: step.doneBy === USER ? 'tu' : `/${step.doneBy}`,
          task: step.task,
          contracts: [],
          contractsWhenNeeded: [],
          calls: step.calls.map((agent) => `/${agent}`),
        };
  });
  return { id: `agent:${definition.agent}`, title: `/${definition.agent} · ${definition.title}`, nodes, edges: drawing.edges.map(edgeOf) };
}

function originOfOwnSkill(name: string, contractNames: ReadonlySet<string>): Origin {
  return contractNames.has(name) || ENGINE_SKILLS.has(name) ? 'langgraph' : 'mine';
}

function storyNode(id: string): FlowNode {
  const boundary = BOUNDARIES[id];
  if (boundary !== undefined) {
    return boundary;
  }
  const step = id === 'planning' ? 'plan' : isStepName(id) ? id : undefined;
  if (step === undefined) {
    return emptyNode(id);
  }
  const described = describedStep(step);
  return { id, ...described, doneBy: concreteDoer(described.contracts) };
}

function coachNode(id: string): FlowNode {
  const boundary = BOUNDARIES[id];
  if (boundary !== undefined) {
    return boundary;
  }
  const task = COACH_TASKS[id];
  return task === undefined ? emptyNode(id) : { id, doneBy: '/coach', task, contracts: [COACH_CONTRACT], contractsWhenNeeded: [] };
}

function concreteDoer(contracts: readonly string[]): string {
  return contracts.length === 0 ? FLOW_ENGINE : contracts.map((contract) => `/${contract.replace(/\.md$/, '')}`).join(' + ');
}

function emptyNode(id: string): FlowNode {
  return { id, doneBy: FLOW_ENGINE, task: '', contracts: [], contractsWhenNeeded: [] };
}

function edgeOf(edge: { readonly source: string; readonly target: string; readonly conditional?: boolean }) {
  return { source: edge.source, target: edge.target, conditional: edge.conditional === true };
}
