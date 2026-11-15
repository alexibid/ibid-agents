import { describe, expect, it } from 'vitest';
import { commandToRun, summaryOf, type CaseReport } from './evals';

const report = (lastResult: CaseReport['lastResult']): CaseReport => ({
  caseId: lastResult,
  request: 'pedido',
  stopsAt: 'finished',
  mentions: [],
  lastResult,
  details: [],
  ranOn: '',
  runId: '',
});

describe('summaryOf', () => {
  it('should count the cases that passed, all the cases and those never run', () => {
    expect(summaryOf([report('passed'), report('failed'), report('never-run')])).toEqual({ passed: 1, total: 3, neverRun: 1 });
  });

  it('should count nothing for an agent without cases', () => {
    expect(summaryOf([])).toEqual({ passed: 0, total: 0, neverRun: 0 });
  });
});

describe('commandToRun', () => {
  it('should give the command that runs one agent evaluations', () => {
    expect(commandToRun('ev')).toBe('cd /Users/alexsantos/Projects/ibid-agents/langgraph && npm run evals -- ev');
  });
});
