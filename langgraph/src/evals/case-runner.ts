import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentRunFlow } from '../agent-runs/agent-run-flow.js';
import type { Database, Row } from '../store/database.js';
import type { EvalCase } from './eval-case.js';
import type { EvalOutcome } from './eval-judge.js';

interface RunRow extends Row {
  readonly id: string;
  readonly status: string;
}

const CASE_TIMEOUT_MS = 20 * 60_000;
const ALLOWED_TOOLS = [
  'mcp__ibid-langgraph__start_agent_run',
  'mcp__ibid-langgraph__submit_agent_step',
  'mcp__ibid-langgraph__agent_run_status',
  'Skill',
  'Read',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
];
const RUN_OF_CASE = `select id, status from agent_runs where agent = $1 and started_at >= $2 order by started_at desc limit 1`;
const PROGRESS_EVERY_MS = 10_000;
const LAST_STEP = `
  select agent_run_events.step, agent_run_events.passed from agent_run_events
  join agent_runs on agent_runs.id = agent_run_events.run_id
  where agent_runs.agent = $1 and agent_runs.started_at >= $2 order by agent_run_events.id desc limit 1`;

interface StepRow extends Row {
  readonly step: string;
  readonly passed: boolean;
}

export type Progress = (message: string) => void;

export async function runCase(
  agent: string,
  evalCase: EvalCase,
  parts: { readonly database: Database; readonly runs: AgentRunFlow; readonly progress: Progress },
): Promise<EvalOutcome> {
  const startedAt = new Date();
  const ticker = setInterval(() => void reportProgress(agent, startedAt, parts), PROGRESS_EVERY_MS);
  const answered = await askClaude(`/${agent} ${evalCase.request}`, evalCase.workingDirectory || (await mkdtemp(join(tmpdir(), 'ibid-eval-')))).finally(
    () => clearInterval(ticker),
  );
  const run = (await parts.database.rows<RunRow>(RUN_OF_CASE, [agent, startedAt])).at(0);
  const next = run === undefined ? 'nothing' : (await parts.runs.report(run.id)).next;
  return {
    answer: answered.answer,
    toolError: answered.error,
    runId: run?.id ?? '',
    runStatus: run?.status ?? '',
    waitingAt: next === 'nothing' ? '' : next.step,
  };
}

async function reportProgress(agent: string, startedAt: Date, parts: { readonly database: Database; readonly progress: Progress }): Promise<void> {
  const seconds = Math.round((Date.now() - startedAt.getTime()) / 1000);
  const last = (await parts.database.rows<StepRow>(LAST_STEP, [agent, startedAt]).catch(() => [])).at(0);
  const where = last === undefined ? 'a começar o fluxo' : `último passo: ${last.step} (${last.passed ? 'passou' : 'falhou, a corrigir'})`;
  parts.progress(`    ${seconds} s · ${where}`);
}

function askClaude(prompt: string, workingDirectory: string): Promise<{ readonly answer: string; readonly error: string }> {
  const options = ['-p', prompt, '--output-format', 'json', '--allowedTools', ...ALLOWED_TOOLS];
  return new Promise((resolve) => {
    execFile('claude', options, { cwd: workingDirectory, timeout: CASE_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 }, (failure, stdout) => {
      try {
        const reply = JSON.parse(stdout) as { readonly result?: unknown; readonly is_error?: unknown };
        const answer = typeof reply.result === 'string' ? reply.result : '';
        resolve(reply.is_error === true ? { answer: '', error: answer || 'Claude reported an error.' } : { answer, error: '' });
      } catch {
        resolve({ answer: '', error: failure?.message ?? 'Claude gave no answer that could be read.' });
      }
    });
  });
}
