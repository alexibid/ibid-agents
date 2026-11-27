import { repairStepFor, type StepName } from '../domain/steps.js';
import { undeclaredFilesIn, type StepResult } from './evidence.js';
import type { FlowStateUpdate, FlowStateValue, HistoryEntry } from './state.js';

export const MAX_ATTEMPTS = 3;

const HAND_BACK_ATTEMPTS = ' hand-back';
const EXTRA_FILES_ATTEMPTS = ' extra-files';

export function clearedAttempts(step: StepName, attempts: Readonly<Record<string, number>>): Record<string, number> {
  const prefix = `${step} `;
  return Object.fromEntries(Object.entries(attempts).filter(([key]) => key !== step && !key.startsWith(prefix)));
}

export function sentBack(step: StepName, result: StepResult, state: FlowStateValue): FlowStateUpdate {
  if (result.asksTheUser) {
    return { status: 'needs-user', history: [{ step, passed: false, details: result.details }] };
  }
  const { counter, count } = nextAttempt(step, result, state);
  const attempts = { ...state.attempts, [counter]: count };
  const exhausted = !state.commitRequested && count >= MAX_ATTEMPTS;
  const retried = result.malformed || result.undeclaredFiles.length > 0 ? step : repairStepFor(step, state.queue);
  return {
    ...(!result.malformed ? { lastPasses: { [step]: undefined } } : {}),
    attempts,
    position: state.queue.indexOf(retried),
    status: exhausted ? 'needs-user' : 'working',
    history: [{ step, passed: false, details: result.details }],
  };
}

function nextAttempt(step: StepName, result: StepResult, state: FlowStateValue): { readonly counter: string; readonly count: number } {
  if (result.malformed) {
    const counter = `${step}${HAND_BACK_ATTEMPTS}`;
    return { counter, count: (state.attempts[counter] ?? 0) + 1 };
  }
  if (result.undeclaredFiles.length > 0) {
    const counter = `${step}${EXTRA_FILES_ATTEMPTS}`;
    const previous = previousUndeclaredFor(step, state.history);
    const repeatsUnresolved = result.undeclaredFiles.some((file) => previous.has(file));
    return { counter, count: repeatsUnresolved ? (state.attempts[counter] ?? 0) + 1 : 1 };
  }
  return { counter: step, count: (state.attempts[step] ?? 0) + 1 };
}

function previousUndeclaredFor(step: StepName, history: readonly HistoryEntry[]): ReadonlySet<string> {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry === undefined || entry.step !== step) {
      continue;
    }
    if (entry.passed) {
      return new Set();
    }
    const files = undeclaredFilesIn(entry.details);
    if (files.length > 0) {
      return new Set(files);
    }
  }
  return new Set();
}
