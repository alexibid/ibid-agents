import { describe, expect, it } from 'vitest';
import type { EvalCase } from './eval-case.js';
import { judgeEval, type EvalOutcome } from './eval-judge.js';

const evalCase: EvalCase = {
  id: 'quote-without-meter',
  request: 'O orçamento não tem contador. Está conforme?',
  workingDirectory: '',
  expect: { stopsAt: 'finished', mentions: ['contador', 'Tipo B'], avoids: ['está conforme'] },
};

const outcome = (fields: Partial<EvalOutcome>): EvalOutcome => ({
  answer: 'Falta o contador certificado e o diferencial tem de ser do tipo B.',
  runId: 'ev~1',
  runStatus: 'finished',
  waitingAt: '',
  toolError: '',
  ...fields,
});

describe('judgeEval', () => {
  it('should pass a run that finished its flow and says what it must, ignoring accents and case', () => {
    expect(judgeEval(evalCase, outcome({}))).toEqual({ passed: true, details: [] });
  });

  it('should fail an answer given without the flow', () => {
    expect(judgeEval(evalCase, outcome({ runId: '' })).details).toContain('The agent answered without going through its flow.');
  });

  it('should fail a run that stopped somewhere else', () => {
    const verdict = judgeEval({ ...evalCase, expect: { ...evalCase.expect, stopsAt: 'approval' } }, outcome({}));

    expect(verdict.details).toEqual(['The run stopped at "finished", expected "approval".']);
  });

  it('should accept a run that waits at the expected step', () => {
    const waiting = { ...evalCase, expect: { stopsAt: 'approval', mentions: [], avoids: [] } };

    expect(judgeEval(waiting, outcome({ runStatus: 'working', waitingAt: 'approval' })).passed).toBe(true);
  });

  it('should list what is missing and what must not be said', () => {
    const verdict = judgeEval(evalCase, outcome({ answer: 'Sim, está conforme.' }));

    expect(verdict.details).toEqual([
      'The answer does not mention "contador".',
      'The answer does not mention "Tipo B".',
      'The answer says "está conforme", which it must not.',
    ]);
  });

  it('should report a tool that could not run before anything else', () => {
    expect(judgeEval(evalCase, outcome({ toolError: 'Failed to authenticate' })).details).toEqual([
      'The tool could not run the case: Failed to authenticate',
    ]);
  });
});
