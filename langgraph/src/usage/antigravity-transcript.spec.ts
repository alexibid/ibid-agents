import { describe, expect, it } from 'vitest';
import { promptsOfAntigravityTranscript } from './antigravity-transcript.js';

const step = (fields: Readonly<Record<string, unknown>>) => JSON.stringify({ status: 'DONE', ...fields });

const userInput = (stepIndex: number, content: string, createdAt: string) =>
  step({ step_index: stepIndex, source: 'USER_EXPLICIT', type: 'USER_INPUT', content, created_at: createdAt });

const planner = (stepIndex: number, createdAt: string, toolCalls: readonly unknown[] = []) =>
  step({
    step_index: stepIndex,
    source: 'MODEL',
    type: 'PLANNER_RESPONSE',
    created_at: createdAt,
    input_tokens: 100,
    output_tokens: 7,
    cache_read_tokens: 60,
    tool_calls: toolCalls,
  });

const read = (lines: readonly string[]) => promptsOfAntigravityTranscript({ conversationId: 'conversation-1', lines });

describe('promptsOfAntigravityTranscript', () => {
  it('should turn each user input into one prompt and add up the tokens of its steps', () => {
    const prompts = read([
      userInput(0, 'first request', '2026-11-13T10:00:00Z'),
      planner(1, '2026-11-13T10:00:04Z'),
      planner(2, '2026-11-13T10:00:09Z'),
      userInput(3, 'second request', '2026-11-13T10:02:00Z'),
    ]);

    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toMatchObject({
      id: 'antigravity:conversation-1:0',
      tool: 'antigravity',
      conversationId: 'conversation-1',
      text: 'first request',
      askedOn: '2026-11-13T10:00:00Z',
      finishedOn: '2026-11-13T10:00:09Z',
      tokens: { input: 200, output: 14, cacheRead: 120, cacheWrite: 0 },
    });
    expect(prompts[1]?.tokens).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  });

  it('should keep LangGraph and agent calls with the step that answered them, and no other tool', () => {
    const [prompt] = read([
      userInput(0, 'build it', '2026-11-13T10:00:00Z'),
      planner(1, '2026-11-13T10:00:01Z', [
        { name: 'mcp_ibid-langgraph_start_story', args: { project: 'papikapi' } },
        { name: 'run_command', args: { CommandLine: 'ls' } },
      ]),
      step({ step_index: 2, source: 'MODEL', type: 'GENERIC', content: 'story started', created_at: '2026-11-13T10:00:02Z' }),
      planner(3, '2026-11-13T10:00:03Z', [{ name: 'browser_subagent', args: { Task: 'open the page' } }]),
      step({ step_index: 4, source: 'MODEL', type: 'GENERIC', status: 'ERROR', content: 'timed out', created_at: '2026-11-13T10:00:08Z' }),
    ]);

    expect(prompt?.agentCalls).toEqual([
      expect.objectContaining({ kind: 'langgraph', agent: 'LangGraph', response: 'story started', failed: false }),
      expect.objectContaining({ kind: 'agent', agent: 'browser_subagent', response: 'timed out', failed: true }),
    ]);
    expect(prompt?.agentCalls[0]?.request).toContain('papikapi');
  });

  it('should keep a failed step as an error of the prompt', () => {
    const [prompt] = read([
      userInput(0, 'request', '2026-11-13T10:00:00Z'),
      step({ step_index: 1, source: 'MODEL', type: 'RUN_COMMAND', status: 'ERROR', error: 'command not found', created_at: '2026-11-13T10:00:01Z' }),
    ]);

    expect(prompt?.errors).toEqual(['command not found']);
  });

  it('should ignore what comes before the first user input and unreadable lines', () => {
    expect(read(['not json', planner(0, '2026-11-13T10:00:00Z')])).toEqual([]);
  });
});
