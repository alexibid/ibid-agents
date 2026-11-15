export interface CaseReport {
  readonly caseId: string;
  readonly request: string;
  readonly stopsAt: string;
  readonly mentions: readonly string[];
  readonly lastResult: 'passed' | 'failed' | 'never-run';
  readonly details: readonly string[];
  readonly ranOn: string;
  readonly runId: string;
}

export interface EvalsSummary {
  readonly passed: number;
  readonly total: number;
  readonly neverRun: number;
}

export function summaryOf(cases: readonly CaseReport[]): EvalsSummary {
  return {
    passed: cases.filter((report) => report.lastResult === 'passed').length,
    total: cases.length,
    neverRun: cases.filter((report) => report.lastResult === 'never-run').length,
  };
}

export function commandToRun(agent: string): string {
  return `cd /Users/alexsantos/Projects/ibid-agents/langgraph && npm run evals -- ${agent}`;
}
