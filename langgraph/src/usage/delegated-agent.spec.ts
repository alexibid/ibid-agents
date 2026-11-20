import { describe, expect, it } from 'vitest';
import { agentNamedIn, delegatedAgentOf } from './delegated-agent.js';

describe('delegatedAgentOf', () => {
  it('should keep a named agent type', () => {
    expect(delegatedAgentOf({ subagent_type: 'developer', prompt: 'Read agents/reviewer.md' })).toBe('developer');
  });

  it('should name a generic agent after the first contract its prompt hands over', () => {
    const prompt = 'Read first: /Users/me/ibid-agents/agents/specialist.md and /Users/me/ibid-agents/agents/nx.md';

    expect(delegatedAgentOf({ subagent_type: 'claude', prompt })).toBe('specialist');
  });

  it('should never name an agent after the contracts README', () => {
    expect(delegatedAgentOf({ subagent_type: 'claude', prompt: 'see ibid-agents/agents/README.md then ibid-agents/agents/ui.md' })).toBe('ui');
  });

  it('should fall back to a slug description when the prompt names no contract', () => {
    expect(delegatedAgentOf({ subagent_type: 'claude', description: 'test-author', prompt: 'write the tests' })).toBe(
      'test-author',
    );
  });

  it('should keep the generic type when nothing names the agent', () => {
    expect(delegatedAgentOf({ subagent_type: 'Explore', description: 'Find the service', prompt: 'find it' })).toBe('Explore');
    expect(delegatedAgentOf({ prompt: 'find it' })).toBe('general-purpose');
  });

  it('should not take an agents folder outside ibid-agents for a contract', () => {
    expect(delegatedAgentOf({ subagent_type: 'general-purpose', prompt: 'create fixtures/agents/placeholder.md' })).toBe(
      'general-purpose',
    );
  });

  it('should name an agent after the skill its prompt hands over', () => {
    expect(agentNamedIn('Follow your protocol in ~/.gemini/config/skills/visual-qa/SKILL.md')).toBe('visual-qa');
  });
});
