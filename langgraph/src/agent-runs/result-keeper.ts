import type { FlowStep } from './definition.js';

export interface PassedStep {
  readonly runId: string;
  readonly step: FlowStep;
  readonly handedBack: Readonly<Record<string, unknown>>;
  readonly earlier: Readonly<Record<string, unknown>>;
}

export interface ResultKeeper {
  keep(passed: PassedStep): Promise<boolean>;
}

export const KEEPS_NOTHING: ResultKeeper = { keep: async () => true };
