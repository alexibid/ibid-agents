import { Command, MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';
import type { AgentFlowDefinition } from './definition.js';
import { buildAgentRunGraph, MAX_ATTEMPTS, type RunInstruction } from './graph.js';
import type { AgentRunStateValue } from './state.js';

const definition: AgentFlowDefinition = {
  agent: 'ev',
  title: 'EV',
  skillFile: '/skills/ev/SKILL.md',
  steps: [
    { id: 'understand', name: 'Perceber', doneBy: 'ev', task: 'Restate the request.', fields: { request: 'text' }, calls: [] },
    { id: 'answer', name: 'Responder', doneBy: 'ev', task: 'Answer with sources.', fields: { answer: 'text', sources: 'list' }, calls: ['trader-worker'] },
  ],
};

async function waitingOn(graph: ReturnType<typeof buildAgentRunGraph>, threadId: string) {
  const snapshot = await graph.getState({ configurable: { thread_id: threadId } });
  const values = snapshot.values as AgentRunStateValue;
  const pending = snapshot.tasks.flatMap((task) => task.interrupts).at(0)?.value as RunInstruction | undefined;
  return { status: values.status, step: pending?.step ?? 'nothing', history: values.history };
}

describe('buildAgentRunGraph', () => {
  it('should hand out one step at a time and finish after the last one passes', async () => {
    const graph = buildAgentRunGraph(definition, new MemorySaver());
    const config = { configurable: { thread_id: 'run-1' } };

    await graph.invoke({ agent: 'ev', request: 'quote' }, config);
    expect(await waitingOn(graph, 'run-1')).toMatchObject({ step: 'understand', status: 'working' });

    await graph.invoke(new Command({ resume: { request: 'compare two quotes' } }), config);
    expect(await waitingOn(graph, 'run-1')).toMatchObject({ step: 'answer' });

    await graph.invoke(new Command({ resume: { answer: 'B is better', sources: ['DL 93/2025'] } }), config);
    expect(await waitingOn(graph, 'run-1')).toMatchObject({ step: 'nothing', status: 'finished' });
  });

  it('should keep a step until its hand-back is complete, and give up after the last attempt', async () => {
    const graph = buildAgentRunGraph(definition, new MemorySaver());
    const config = { configurable: { thread_id: 'run-2' } };
    await graph.invoke({ agent: 'ev', request: 'quote' }, config);

    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      await graph.invoke(new Command({ resume: {} }), config);
      expect(await waitingOn(graph, 'run-2')).toMatchObject({ step: 'understand', status: 'working' });
    }
    await graph.invoke(new Command({ resume: {} }), config);

    const state = await waitingOn(graph, 'run-2');
    expect(state).toMatchObject({ step: 'nothing', status: 'needs-user' });
    expect(state.history.filter((entry) => !entry.passed)).toHaveLength(MAX_ATTEMPTS);
  });
});
