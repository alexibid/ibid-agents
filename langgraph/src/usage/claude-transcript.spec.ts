import { describe, expect, it } from 'vitest';
import { limitHitsOfClaudeTranscript, promptsOfClaudeTranscript } from './claude-transcript.js';

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

  it('should keep a line written twice in the transcript in its first prompt only', () => {
    const repeated = JSON.stringify({ ...JSON.parse(answered('m1', [toolUse('t1', 'Bash', { command: 'ls' })], '2026-11-13T10:00:01.000Z')), uuid: 'line-1' });
    const prompts = promptsOfClaudeTranscript([
      asked('p1', 'first request', '2026-11-13T10:00:00.000Z'),
      repeated,
      asked('p2', 'second request', '2026-11-13T10:01:00.000Z'),
      repeated,
    ]);

    expect(prompts.map((prompt) => prompt.agentCalls.map(({ id }) => id))).toEqual([['t1'], []]);
    expect(prompts[1]?.tokens).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  });

  it('should list the agents, skills, LangGraph calls and tools of a prompt with what came back', () => {
    const [prompt] = promptsOfClaudeTranscript([
      asked('p1', 'build it', '2026-11-13T10:00:00.000Z'),
      answered(
        'm1',
        [
          toolUse('t1', 'Agent', { subagent_type: 'Explore', prompt: 'find the service' }),
          toolUse('t2', 'mcp__ibid-langgraph__start_story', { project: 'papikapi' }),
          toolUse('t3', 'Skill', { skill: 'assistant', args: 'go' }),
          toolUse('t4', 'Bash', { command: 'ls' }),
        ],
        '2026-11-13T10:00:01.000Z',
      ),
      asked('p1', [toolResult('t1', 'found it'), { ...toolResult('t2', 'unknown project'), is_error: true }], '2026-11-13T10:00:09.000Z'),
    ]);

    expect(prompt?.agentCalls).toEqual([
      { id: 't1', kind: 'agent', agent: 'Explore', request: 'find the service', response: 'found it', failed: false, calledOn: '2026-11-13T10:00:01.000Z', calledBy: '' },
      expect.objectContaining({ id: 't2', kind: 'langgraph', agent: 'LangGraph', response: 'unknown project', failed: true }),
      expect.objectContaining({ id: 't3', kind: 'skill', agent: 'assistant', request: 'go', response: '' }),
      expect.objectContaining({ id: 't4', kind: 'tool', agent: 'Bash' }),
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

describe('promptsOfClaudeTranscript, telling the user apart from the tool', () => {
  const written = (promptId: string, content: string, fields: Readonly<Record<string, unknown>>) =>
    JSON.stringify({ type: 'user', promptId, timestamp: '2026-11-13T10:00:00.000Z', message: { role: 'user', content }, ...session, ...fields });

  it('should keep a message the tool wrote for itself inside the request that was running', () => {
    const prompts = promptsOfClaudeTranscript([
      written('p1', 'fix everything', { origin: { kind: 'human' }, turnOrigin: 'human' }),
      written('p2', 'I hit my usage limit while you were working', { turnOrigin: 'host_synthetic' }),
      answered('m1', [{ type: 'text', text: 'done' }], '2026-11-13T10:09:00.000Z'),
      written('p3', '<bash-input>npm test</bash-input>', { origin: { kind: 'human' }, turnOrigin: 'human' }),
      written('p4', 'This session is being continued from a previous conversation', { turnOrigin: 'human', isCompactSummary: true }),
    ]);

    expect(prompts.map((prompt) => prompt.text)).toEqual(['fix everything']);
    expect(prompts[0]?.tokens.output).toBe(20);
  });

  it('should show a slash command as the user typed it', () => {
    const [prompt] = promptsOfClaudeTranscript([
      written('p1', '<command-message>assistant</command-message>\n<command-name>/assistant</command-name>\n<command-args>check the workspace</command-args>', {
        origin: { kind: 'human' },
      }),
    ]);

    expect(prompt?.text).toBe('/assistant check the workspace');
  });

  it('should show what the user wrote after a local command', () => {
    const [prompt] = promptsOfClaudeTranscript([
      written('p1', '<command-name>/model</command-name>\n<command-args>opus</command-args>\n<local-command-stdout>Set model</local-command-stdout>\ncarry on', {
        origin: { kind: 'human' },
      }),
    ]);

    expect(prompt?.text).toBe('carry on');
  });
});

describe('limitHitsOfClaudeTranscript', () => {
  const refusal = (rateLimitType: string, status: string) =>
    JSON.stringify({ type: 'assistant', timestamp: '2026-11-13T10:05:17.152Z', quotaLimits: { status, resetsAt: 1794579000, rateLimitType } });

  it('should read the moment a limit was hit and when it resets', () => {
    expect(limitHitsOfClaudeTranscript([refusal('five_hour', 'rejected'), refusal('seven_day', 'rejected')])).toEqual([
      { tool: 'claude', window: '5h', hitOn: '2026-11-13T10:05:17.152Z', resetsOn: '2026-11-13T14:10:00.000Z' },
      { tool: 'claude', window: 'weekly', hitOn: '2026-11-13T10:05:17.152Z', resetsOn: '2026-11-13T14:10:00.000Z' },
    ]);
  });

  it('should ignore a limit that only warned, an unknown window and other lines', () => {
    const lines = [refusal('five_hour', 'allowed_warning'), refusal('monthly', 'rejected'), JSON.stringify({ type: 'user' }), 'not json'];

    expect(limitHitsOfClaudeTranscript(lines)).toEqual([]);
  });
});
