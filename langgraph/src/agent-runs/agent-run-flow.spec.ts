import { MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';
import { AgentRunFlow } from './agent-run-flow.js';
import type { AgentFlowDefinition } from './definition.js';

const definition: AgentFlowDefinition = {
  agent: 'ev',
  title: 'EV',
  skillFile: '/skills/ev/SKILL.md',
  steps: [{ id: 'understand', name: 'Perceber', doneBy: 'ev', task: 'Restate the request.', fields: { request: 'text' }, calls: [] }],
};

describe('AgentRunFlow abandoning a run', () => {
  it('should stop handing out steps once the run is abandoned', async () => {
    const flow = new AgentRunFlow([definition], new MemorySaver());
    const { runId } = await flow.start('ev', 'quote');

    const abandoned = await flow.abandon(runId);

    expect(abandoned).toMatchObject({ status: 'abandoned', next: 'nothing' });
    expect(await flow.submit(runId, { request: 'late answer' })).toMatchObject({ status: 'abandoned', next: 'nothing' });
  });

  it('should leave a finished run as it is', async () => {
    const flow = new AgentRunFlow([definition], new MemorySaver());
    const { runId } = await flow.start('ev', 'quote');
    await flow.submit(runId, { request: 'compare two quotes' });

    expect(await flow.abandon(runId)).toMatchObject({ status: 'finished' });
  });
});
