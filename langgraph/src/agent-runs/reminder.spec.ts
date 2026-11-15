import { describe, expect, it } from 'vitest';
import { answerFor, invokedFlows, promptOf, reminderFor } from './reminder.js';

const withFlow = new Set(['ev', 'trader', 'trader-worker']);

describe('promptOf', () => {
  it('should read the prompt Claude sends', () => {
    expect(promptOf(JSON.stringify({ prompt: '/ev compara' }))).toEqual({ prompt: '/ev compara', tool: 'claude' });
  });

  it('should read the prompt Antigravity sends', () => {
    expect(promptOf(JSON.stringify({ lastUserInput: '/trader hoje' }))).toEqual({ prompt: '/trader hoje', tool: 'antigravity' });
  });

  it('should read nothing from an unreadable payload', () => {
    expect(promptOf('not json').prompt).toBe('');
  });
});

describe('invokedFlows', () => {
  it.each([
    ['/ev compara dois orçamentos', ['ev']],
    ['<command-name>/trader</command-name>', ['trader']],
    ['  /trader-worker grava isto', ['trader-worker']],
    ['pede ao /trader-worker e depois ao /trader', []],
    ['> node run-evals.js ev\n/ev quote-type-a-no-meter: a correr', []],
    ['vê em https://site.pt/ev/precos', []],
    ['/coach próxima lição', []],
    ['sem comando', []],
  ])('should find in "%s" the agents %j', (prompt, agents) => {
    expect(invokedFlows(prompt, withFlow)).toEqual(agents);
  });
});

describe('answerFor', () => {
  it('should add nothing when no agent with a flow was named', () => {
    expect(answerFor('claude', reminderFor([]))).toBe('');
  });

  it('should give Claude extra context and Antigravity an extra step', () => {
    const reminder = reminderFor(['ev']);

    expect(JSON.parse(answerFor('claude', reminder)).hookSpecificOutput.additionalContext).toContain('start_agent_run');
    expect(JSON.parse(answerFor('antigravity', reminder)).injectSteps[0].ephemeralMessage).toContain('agent "ev"');
  });
});
