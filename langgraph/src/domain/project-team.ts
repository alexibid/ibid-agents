import type { Condition, StepName } from './steps.js';

export type TeamStep = StepName | 'plan';

export interface ProjectAgent {
  readonly agent: string;
  readonly step: TeamStep;
  readonly when: Condition;
  readonly contract: string;
}

export const GENERIC_SPECIALIST = 'agents/specialist.md';

export function agentsJoining(
  step: TeamStep,
  conditions: readonly Condition[],
  agents: readonly ProjectAgent[],
): ProjectAgent[] {
  return agents.filter((agent) => agent.step === step && (agent.when === 'always' || conditions.includes(agent.when)));
}
