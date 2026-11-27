import { describe, expect, it } from 'vitest';
import type { StepName } from '../domain/steps.js';
import { appState, storyState, unclassifiedSheet } from './discovery-state.mock.js';
import { planInstruction, stepInstruction } from './instructions.js';

const SEO_RULES = '/repo/rules/discovery/seo.md';
const ASO_RULES = '/repo/rules/discovery/aso.md';
const BUILDING_STEPS: readonly StepName[] = ['author-tests', 'validate-tests', 'implement', 'review'];

describe('discovery rules in the hand-out', () => {
  it('should give the SEO rules to the plan and to every step that tests, builds or reviews a website', () => {
    const state = storyState();

    expect(planInstruction(state).contracts).toContain(SEO_RULES);
    expect(BUILDING_STEPS.filter((step) => !stepInstruction(step, state).contracts.includes(SEO_RULES))).toEqual([]);
  });

  it('should give an app the ASO rules instead', () => {
    expect(stepInstruction('implement', appState()).contracts).toEqual(expect.arrayContaining([ASO_RULES]));
    expect(stepInstruction('implement', appState()).contracts).not.toContain(SEO_RULES);
  });

  it('should add nothing for a project the sheet does not classify, nor for steps that do not judge the change', () => {
    const unclassified = storyState(unclassifiedSheet);

    expect([...planInstruction(unclassified).contracts, ...stepInstruction('implement', unclassified).contracts].filter((path) => path.includes('discovery'))).toEqual([]);
    expect(stepInstruction('browser-qa', storyState()).contracts).not.toContain(SEO_RULES);
  });
});
