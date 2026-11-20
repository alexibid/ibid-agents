import { repairStepFor, type StepName } from '../domain/steps.js';
import type { StepResult } from './evidence.js';
import type { FlowStateUpdate, FlowStateValue } from './state.js';

export const MAX_ATTEMPTS = 3;

const HAND_BACK_ATTEMPTS = ' hand-back';

export function sentBack(step: StepName, result: StepResult, state: FlowStateValue): FlowStateUpdate {
  const counter = result.malformed ? `${step}${HAND_BACK_ATTEMPTS}` : step;
  const attempts = { ...state.attempts, [counter]: (state.attempts[counter] ?? 0) + 1 };
  const exhausted = (attempts[counter] ?? 0) >= MAX_ATTEMPTS;
  const retried = result.malformed ? step : repairStepFor(step, state.queue);
  return {
    attempts,
    position: state.queue.indexOf(retried),
    status: exhausted ? 'needs-user' : 'working',
    history: [{ step, passed: false, details: result.details }],
  };
}
