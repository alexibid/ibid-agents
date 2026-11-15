#!/usr/bin/env node
import { agentRunFlowOf, SKILLS_DIRECTORY } from '../agent-runs/setup.js';
import { Database } from '../store/database.js';
import { runCase } from './case-runner.js';
import { evalsIn } from './eval-case.js';
import { judgeEval } from './eval-judge.js';

const KEEP_RESULT = `
  insert into eval_results (agent, case_id, request, passed, details, run_id, answer)
  values ($1, $2, $3, $4, $5, $6, $7)`;

const wanted = new Set(process.argv.slice(2));
const database = new Database();
const runs = await agentRunFlowOf(database);
const suites = (await evalsIn(SKILLS_DIRECTORY)).filter((suite) => wanted.size === 0 || wanted.has(suite.agent));
let failures = 0;

for (const suite of suites) {
  for (const evalCase of suite.cases) {
    console.log(`/${suite.agent} ${evalCase.id}: a correr, pode demorar alguns minutos`);
    const outcome = await runCase(suite.agent, evalCase, { database, runs, progress: (message) => console.log(message) });
    const verdict = judgeEval(evalCase, outcome);
    await database.inOneTransaction([
      {
        text: KEEP_RESULT,
        values: [suite.agent, evalCase.id, evalCase.request, verdict.passed, verdict.details, outcome.runId, outcome.answer.slice(0, 20_000)],
      },
    ]);
    failures += verdict.passed ? 0 : 1;
    console.log(verdict.passed ? '  → passou' : `  → falhou\n    ${verdict.details.join('\n    ')}`);
  }
}

await database.close();
console.log(suites.length === 0 ? 'Nenhum agente com avaliações corresponde ao pedido.' : `${failures} caso(s) falharam.`);
process.exitCode = failures === 0 ? 0 : 1;
