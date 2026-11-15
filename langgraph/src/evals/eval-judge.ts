import { FINISHED, type EvalCase } from './eval-case.js';

export interface EvalOutcome {
  readonly answer: string;
  readonly runId: string;
  readonly runStatus: string;
  readonly waitingAt: string;
  readonly toolError: string;
}

export interface EvalVerdict {
  readonly passed: boolean;
  readonly details: readonly string[];
}

export function judgeEval(evalCase: EvalCase, outcome: EvalOutcome): EvalVerdict {
  if (outcome.toolError !== '') {
    return { passed: false, details: [`The tool could not run the case: ${outcome.toolError}`] };
  }
  const details = [...flowProblems(evalCase, outcome), ...contentProblems(evalCase, outcome.answer)];
  return { passed: details.length === 0, details };
}

function flowProblems({ expect }: EvalCase, outcome: EvalOutcome): string[] {
  if (outcome.runId === '') {
    return ['The agent answered without going through its LangGraph flow.'];
  }
  const reached = outcome.runStatus === FINISHED ? FINISHED : outcome.waitingAt;
  return reached === expect.stopsAt ? [] : [`The run stopped at "${reached || outcome.runStatus}", expected "${expect.stopsAt}".`];
}

function contentProblems({ expect }: EvalCase, answer: string): string[] {
  const said = normalised(answer);
  const missing = expect.mentions.filter((phrase) => !said.includes(normalised(phrase))).map((phrase) => `The answer does not mention "${phrase}".`);
  const unwanted = expect.avoids.filter((phrase) => said.includes(normalised(phrase))).map((phrase) => `The answer says "${phrase}", which it must not.`);
  return [...missing, ...unwanted];
}

function normalised(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
