import type { StepName } from './steps.js';

export interface StepModels {
  readonly claude: 'opus' | 'sonnet';
  readonly antigravity: 'pro' | 'flash';
}

const STRONGEST: StepModels = { claude: 'opus', antigravity: 'pro' };
const LIGHTER: StepModels = { claude: 'sonnet', antigravity: 'flash' };

const STEPS_ON_THE_STRONGEST_MODEL: ReadonlySet<StepName | 'plan'> = new Set(['plan', 'implement', 'visual-gate']);

export function modelsFor(step: StepName | 'plan'): StepModels {
  return STEPS_ON_THE_STRONGEST_MODEL.has(step) ? STRONGEST : LIGHTER;
}
