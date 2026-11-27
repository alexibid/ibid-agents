import { END, START, StateGraph, interrupt, type BaseCheckpointSaver } from '@langchain/langgraph';
import { followUpFor } from './decision-issues.js';
import type { AgentFlowDefinition, FlowStep } from './definition.js';
import { handBackShapeOf, judgeHandBack } from './judge.js';
import { AgentRunState, type AgentRunStateUpdate, type AgentRunStateValue } from './state.js';

export interface RunInstruction {
  readonly agent: string;
  readonly step: string;
  readonly stepName: string;
  readonly doneBy: string;
  readonly calls: readonly string[];
  readonly task: string;
  readonly handBack: string;
  readonly skill: string;
  readonly request: string;
  readonly earlierResults: Readonly<Record<string, unknown>>;
  readonly lastResult: AgentRunStateValue['history'][number] | 'none';
}

export const MAX_ATTEMPTS = 3;
const USER = 'user';

export function buildAgentRunGraph(definition: AgentFlowDefinition, checkpointer?: BaseCheckpointSaver) {
  const steps = definition.steps;
  const graph = new StateGraph(AgentRunState);

  steps.forEach((step, position) => {
    graph.addNode(step.id, async (state: AgentRunStateValue) => runStep(definition, step, position, state));
  });

  steps.forEach((step, position) => {
    const following = steps[position + 1]?.id ?? END;
    const destinations = [...new Set([step.id, following, END])];
    graph.addConditionalEdges(step.id as never, (state: AgentRunStateValue) => routeAfter(step, following, state), destinations as never);
  });

  graph.addEdge(START, steps[0]?.id as never);
  return graph.compile(checkpointer === undefined ? {} : { checkpointer });
}

export type AgentRunGraph = ReturnType<typeof buildAgentRunGraph>;

async function runStep(
  definition: AgentFlowDefinition,
  step: FlowStep,
  position: number,
  state: AgentRunStateValue,
): Promise<AgentRunStateUpdate> {
  const handedBack: unknown = interrupt(instructionFor(definition, step, state));
  const verdict = await judgeHandBack(step, handedBack, state.results);
  if (verdict.passed) {
    const last = position === definition.steps.length - 1;
    const requiredFollowUp = last ? followUpFor(definition, state.linkedIssues) : 'none';
    return {
      status: last ? 'finished' : 'working',
      ...(requiredFollowUp === 'none' ? {} : { requiredFollowUp }),
      results: { [step.id]: handedBack },
      history: [{ step: step.id, passed: true, details: [] }],
    };
  }
  const attempts = (state.attempts[step.id] ?? 0) + 1;
  return {
    status: attempts >= MAX_ATTEMPTS ? 'needs-user' : 'working',
    attempts: { ...state.attempts, [step.id]: attempts },
    history: [{ step: step.id, passed: false, details: verdict.details }],
  };
}

function routeAfter(step: FlowStep, following: string, state: AgentRunStateValue): string {
  if (state.status === 'needs-user') {
    return END;
  }
  const last = state.history.at(-1);
  return last?.step === step.id && last.passed ? following : step.id;
}

function instructionFor(definition: AgentFlowDefinition, step: FlowStep, state: AgentRunStateValue): RunInstruction {
  return {
    agent: definition.agent,
    step: step.id,
    stepName: step.name,
    doneBy: step.doneBy === USER ? USER : `/${step.doneBy}`,
    calls: step.calls.map((agent) => `/${agent}`),
    task: step.task,
    handBack: handBackShapeOf(step),
    skill: definition.skillFile,
    request: state.request,
    earlierResults: state.results,
    lastResult: state.history.at(-1) ?? 'none',
  };
}
