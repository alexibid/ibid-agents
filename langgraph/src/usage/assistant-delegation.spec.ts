import { describe, expect, it } from 'vitest';
import { withSubagentCalls, type SubagentTranscript } from './claude-subagents.js';
import { promptsOfClaudeTranscript } from './claude-transcript.js';

const CONTRACTS = '/Users/me/Projects/ibid-agents/agents';
const session = { sessionId: 'session-1', cwd: '/work/ibid-workspace' };

const userLine = (content: unknown, timestamp: string, extra: object = {}) =>
  JSON.stringify({ type: 'user', promptId: 'p1', timestamp, message: { role: 'user', content }, ...session, ...extra });
const assistantLine = (id: string, content: readonly unknown[], timestamp: string, extra: object = {}) =>
  JSON.stringify({ type: 'assistant', timestamp, message: { id, model: 'claude-opus-5-5', content, usage: {} }, ...session, ...extra });
const toolUse = (id: string, name: string, input: unknown) => ({ type: 'tool_use', id, name, input });
const toolResult = (id: string, content: string) => ({ type: 'tool_result', tool_use_id: id, content });
const sidechain = { isSidechain: true, agentId: 'a1' };

const assistantTranscript = [
  userLine('plan the story', '2026-11-18T10:00:00.000Z'),
  assistantLine(
    'm1',
    [
      toolUse('lg1', 'mcp__ibid-langgraph__start_story', { project: 'ibid-website' }),
      toolUse('ag1', 'Agent', {
        subagent_type: 'claude',
        description: 'specialist',
        prompt: `You are the specialist. Read ${CONTRACTS}/specialist.md and ${CONTRACTS}/nx.md first.`,
      }),
    ],
    '2026-11-18T10:00:01.000Z',
  ),
  userLine([toolResult('lg1', '{"storyId":"s1"}'), toolResult('ag1', '{"files":["a.ts"]}')], '2026-11-18T10:00:30.000Z'),
];

const specialistTranscript: SubagentTranscript = {
  calledBy: 'ag1',
  depth: 1,
  lines: [
    userLine('You are the specialist.', '2026-11-18T10:00:02.000Z', sidechain),
    assistantLine(
      's1',
      [toolUse('sb1', 'Bash', { command: 'git status' }), toolUse('sr1', 'Read', { file_path: 'a.ts' })],
      '2026-11-18T10:00:03.000Z',
      sidechain,
    ),
    userLine([toolResult('sb1', 'clean'), toolResult('sr1', 'export {}')], '2026-11-18T10:00:04.000Z', sidechain),
    assistantLine('s2', [toolUse('sh1', 'SubagentHandback', { result: 'done' })], '2026-11-18T10:00:05.000Z', sidechain),
  ],
};

describe('an assistant request that delegates to an agent', () => {
  const [prompt] = withSubagentCalls(promptsOfClaudeTranscript(assistantTranscript), [specialistTranscript]);
  const calls = prompt?.agentCalls ?? [];

  it('should name the agent after its contract, not after the generic agent type', () => {
    expect(calls.filter(({ kind }) => kind === 'agent').map(({ agent }) => agent)).toEqual(['specialist']);
  });

  it('should give the tools the agent used to that agent, not to the assistant', () => {
    const agentTools = calls.filter(({ calledBy }) => calledBy === 'ag1').map(({ agent, response }) => ({ agent, response }));

    expect(agentTools).toEqual([
      { agent: 'Bash', response: 'clean' },
      { agent: 'Read', response: 'export {}' },
    ]);
  });

  it('should keep only the assistant own calls as called by the assistant', () => {
    expect(calls.filter(({ calledBy }) => calledBy === '').map(({ id }) => id)).toEqual(['lg1', 'ag1']);
  });

  it('should leave out the hand-back plumbing of the agent', () => {
    expect(calls.map(({ agent }) => agent)).not.toContain('SubagentHandback');
  });

  it('should ignore a subagent transcript that no call of the request started', () => {
    const [unrelated] = withSubagentCalls(promptsOfClaudeTranscript(assistantTranscript), [
      { ...specialistTranscript, calledBy: 'someone-else' },
    ]);

    expect(unrelated?.agentCalls).toHaveLength(2);
  });
});
