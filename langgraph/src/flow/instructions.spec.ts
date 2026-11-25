import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProjectSheet } from '../domain/sheet.js';
import { planInstruction, stepInstruction } from './instructions.js';
import { EMPTY_PLAN, NO_ORIGIN, type FlowStateValue } from './state.js';

const AGENTS_ROOT = '/repo';
const CONTRACTS = join(AGENTS_ROOT, 'agents');

const sheet: ProjectSheet = {
  project: 'figures-app',
  path: 'apps/figures-app',
  commitScope: 'figures-app',
  sheetFile: '/repo/rules/projects/figures-app.md',
  reuses: [],
  specialist: 'agents/figures-app-specialist.md',
  agents: [
    { agent: 'blender', step: 'implement', when: 'figures', contract: 'skills/blender/SKILL.md' },
    { agent: 'market-analyst', step: 'plan', when: 'always', contract: 'skills/market/SKILL.md' },
  ],
  triggers: [],
  mandatorySteps: [{ step: 'implement', when: 'always' }],
  commands: {},
};

const state = (overrides: Partial<FlowStateValue>): FlowStateValue => ({
  story: { project: 'figures-app', title: 'A cat', criteria: ['The cat stands'] },
  origin: NO_ORIGIN,
  commitRequested: false,
  lastPasses: {},
  sheet,
  baseline: {},
  contractsDirectory: CONTRACTS,
  plan: EMPTY_PLAN,
  testFiles: [],
  queue: ['implement'],
  position: 0,
  attempts: {},
  followUps: [],
  status: 'planning',
  history: [],
  ...overrides,
});

describe('planInstruction', () => {
  it('should hand the plan to the project specialist first, then the generic contracts and plan agents', () => {
    const instruction = planInstruction(state({}));

    expect(instruction.doneBy).toBe('figures-app-specialist');
    expect(instruction.contracts).toEqual([
      '/repo/agents/figures-app-specialist.md',
      '/repo/agents/specialist.md',
      '/repo/agents/nx.md',
      '/repo/skills/market/SKILL.md',
    ]);
  });

  it('should fall back to the generic specialist when the sheet names none', () => {
    const instruction = planInstruction(state({ sheet: { ...sheet, specialist: 'agents/specialist.md', agents: [] } }));

    expect(instruction.doneBy).toBe('figures-app specialist');
    expect(instruction.contracts).toEqual(['/repo/agents/specialist.md', '/repo/agents/nx.md']);
  });
});

describe('stepInstruction', () => {
  it('should bring the project agent into implement when the plan declares its condition', () => {
    const instruction = stepInstruction('implement', state({ plan: { ...EMPTY_PLAN, conditions: ['figures'] } }));

    expect(instruction.doneBy).toBe('developer or UI agent, with blender');
    expect(instruction.contracts).toContain('/repo/skills/blender/SKILL.md');
  });

  it('should leave the project agent out when its condition does not hold', () => {
    const instruction = stepInstruction('implement', state({}));

    expect(instruction.doneBy).toBe('developer or UI agent');
    expect(instruction.contracts).toEqual(['/repo/agents/developer.md']);
  });
});

describe('the model named in an instruction', () => {
  it('should name the strongest model of each client for the plan', () => {
    expect(planInstruction(state({})).models).toEqual({ claude: 'opus', antigravity: 'pro' });
  });

  it('should name the lighter model of each client for a review', () => {
    expect(stepInstruction('review', state({ queue: ['review'] })).models).toEqual({ claude: 'sonnet', antigravity: 'flash' });
  });
});
