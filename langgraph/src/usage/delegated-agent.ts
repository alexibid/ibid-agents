import { textIn, type JsonObject } from './json-reading.js';

const GENERIC_AGENT_TYPES: ReadonlySet<string> = new Set(['', 'claude', 'general-purpose', 'Explore', 'Plan', 'fork']);
const AGENT_CONTRACT = /ibid-agents\/agents\/([a-z0-9-]+)\.md\b/g;
const AGENT_SKILL = /skills\/([a-z0-9-]+)\/SKILL\.md\b/g;
const AGENT_SLUG = /^[a-z][a-z0-9-]*$/;
const NOT_AN_AGENT = 'README';
const DEFAULT_AGENT = 'general-purpose';

export function delegatedAgentOf(input: JsonObject): string {
  const agentType = textIn(input, 'subagent_type');
  if (!GENERIC_AGENT_TYPES.has(agentType)) {
    return agentType;
  }
  return agentNamedIn(textIn(input, 'prompt')) || slugIn(textIn(input, 'description')) || agentType || DEFAULT_AGENT;
}

export function agentNamedIn(prompt: string): string {
  return firstNameIn(prompt, AGENT_CONTRACT) || firstNameIn(prompt, AGENT_SKILL);
}

function firstNameIn(prompt: string, pattern: RegExp): string {
  const names = [...prompt.matchAll(pattern)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
  return names.find((name) => name !== NOT_AN_AGENT) ?? '';
}

function slugIn(description: string): string {
  const trimmed = description.trim();
  return AGENT_SLUG.test(trimmed) && !GENERIC_AGENT_TYPES.has(trimmed) ? trimmed : '';
}
