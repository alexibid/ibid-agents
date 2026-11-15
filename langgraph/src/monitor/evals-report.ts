import { SKILLS_DIRECTORY } from '../agent-runs/setup.js';
import { evalsIn } from '../evals/eval-case.js';
import type { Database, Row } from '../store/database.js';

interface ResultRow extends Row {
  readonly caseId: string;
  readonly passed: boolean;
  readonly details: readonly string[];
  readonly ranOn: Date;
  readonly runId: string;
}

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

const LATEST = `
  select distinct on (case_id) case_id as "caseId", passed, details, ran_at as "ranOn", run_id as "runId"
  from eval_results where agent = $1 order by case_id, ran_at desc`;

export async function evalsReportOf(database: Database, agent: string): Promise<CaseReport[]> {
  const suite = (await evalsIn(SKILLS_DIRECTORY)).find((entry) => entry.agent === agent);
  if (suite === undefined) {
    return [];
  }
  const latest = new Map((await database.rows<ResultRow>(LATEST, [agent])).map((row) => [row.caseId, row]));
  return suite.cases.map((evalCase) => {
    const result = latest.get(evalCase.id);
    return {
      caseId: evalCase.id,
      request: evalCase.request,
      stopsAt: evalCase.expect.stopsAt,
      mentions: evalCase.expect.mentions,
      lastResult: result === undefined ? 'never-run' : result.passed ? 'passed' : 'failed',
      details: result?.details ?? [],
      ranOn: result?.ranOn.toISOString() ?? '',
      runId: result?.runId ?? '',
    };
  });
}
