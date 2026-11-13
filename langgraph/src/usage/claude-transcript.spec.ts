import { describe, expect, it } from 'vitest';
import { promptsOfClaudeTranscript } from './claude-transcript.js';

const session = { sessionId: 'session-1', cwd: '/work/ibid-workspace' };

const asked = (promptId: string, content: unknown, timestamp: string) =>
  JSON.stringify({ type: 'user', promptId, timestamp, message: { role: 'user', content }, ...session });

const answered = (messageId: string, content: readonly unknown[], timestamp: string) =>
  JSON.stringify({
    type: 'assistant',
    timestamp,
    message: {
      id: messageId,
      model: 'claude-fable-5-2',
      content,
      usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 300, cache_creation_input_tokens: 4 },
    },
    ...session,
  });

const toolUse = (id: string, name: string, input: unknown) => ({ type: 'tool_use', id, name, input });
const toolResult = (id: string, content: string) => ({ type: 'tool_result', tool_use_id: id, content });

describe('promptsOfClaudeTranscript', () => {
  it('should turn each thing the user asked into one prompt with its tokens', () => {
    const prompts = promptsOfClaudeTranscript([
      asked('p1', 'first request', '2026-11-13T10:00:00.000Z'),
      answered('m1', [{ type: 'text', text: 'done' }], '2026-11-13T10:00:05.000Z'),
      asked('p2', [{ type: 'text', text: 'second request' }], '2026-11-13T10:01:00.000Z'),
      answered('m2', [{ type: 'text', text: 'done' }], '2026-11-13T10:01:09.000Z'),
    ]);

    expect(prompts.map((prompt) => prompt.text)).toEqual(['first request', 'second request']);
    expect(prompts[0]).toMatchObject({
      id: 'claude:session-1:p1',
      tool: 'claude',
      workspace: '/work/ibid-workspace',
      model: 'claude-fable-5-2',
      askedOn: '2026-11-13T10:00:00.000Z',
      finishedOn: '2026-11-13T10:00:05.000Z',
      tokens: { input: 10, output: 20, cacheRead: 300, cacheWrite: 4 },
    });
  });

  it('should count once a message that is written over several lines', () => {
    const [prompt] = promptsOfClaudeTranscript([
      asked('p1', 'request', '2026-11-13T10:00:00.000Z'),
      answered('m1', [{ type: 'text', text: 'part one' }], '2026-11-13T10:00:01.000Z'),
      answered('m1', [{ type: 'text', text: 'part two' }], '2026-11-13T10:00:02.000Z'),
      answered('m2', [{ type: 'text', text: 'next message' }], '2026-11-13T10:00:03.000Z'),
    ]);

    expect(prompt?.tokens).toEqual({ input: 20, output: 40, cacheRead: 600, cacheWrite: 8 });
  });

  it('should list the agents, skills and LangGraph calls of a prompt with what came back', () => {
    const [prompt] = promptsOfClaudeTranscript([
      asked('p1', 'build it', '2026-11-13T10:00:00.000Z'),
      answered(
        'm1',
        [
          toolUse('t1', 'Agent', { subagent_type: 'Explore', prompt: 'find the service' }),
          toolUse('t2', 'mcp__ibid-langgraph__start_story', { project: 'papikapi' }),
          toolUse('t3', 'Skill', { skill: 'assistente', args: 'go' }),
          toolUse('t4', 'Bash', { command: 'ls' }),
        ],
        '2026-11-13T10:00:01.000Z',
      ),
      asked('p1', [toolResult('t1', 'found it'), { ...toolResult('t2', 'unknown project'), is_error: true }], '2026-11-13T10:00:09.000Z'),
    ]);

    expect(prompt?.agentCalls).toEqual([
      { id: 't1', kind: 'agent', agent: 'Explore', request: 'find the service', response: 'found it', failed: false, calledOn: '2026-11-13T10:00:01.000Z' },
      expect.objectContaining({ id: 't2', kind: 'langgraph', agent: 'LangGraph', response: 'unknown project', failed: true }),
      expect.objectContaining({ id: 't3', kind: 'skill', agent: 'assistente', request: 'go', response: '' }),
    ]);
    expect(prompt?.agentCalls[1]?.request).toContain('start_story');
  });

  it('should leave out side conversations, tool results and unreadable lines', () => {
    const prompts = promptsOfClaudeTranscript([
      'not json',
      JSON.stringify({ type: 'user', promptId: 'side', isSidechain: true, message: { content: 'agent prompt' } }),
      asked('p1', [toolResult('t9', 'orphan result')], '2026-11-13T10:00:00.000Z'),
    ]);

    expect(prompts).toEqual([]);
  });

  it('should keep an API failure as an error of the prompt', () => {
    const failure = JSON.stringify({
      type: 'assistant',
      isApiErrorMessage: true,
      timestamp: '2026-11-13T10:00:02.000Z',
      message: { id: 'e1', content: [{ type: 'text', text: 'API Error: overloaded' }] },
    });

    const [prompt] = promptsOfClaudeTranscript([asked('p1', 'request', '2026-11-13T10:00:00.000Z'), failure]);

    expect(prompt?.errors).toEqual(['API Error: overloaded']);
    expect(prompt?.tokens.output).toBe(0);
  });
});
