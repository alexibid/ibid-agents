import type { Condition, StepName } from './steps.js';

export interface MandatoryStep {
  readonly step: StepName;
  readonly when: Condition;
}

export interface ProjectSheet {
  readonly project: string;
  readonly path: string;
  readonly commitScope: string;
  readonly sheetFile: string;
  readonly mandatorySteps: readonly MandatoryStep[];
  readonly commands: Readonly<Partial<Record<StepName, string>>>;
}

export class SheetError extends Error {
  constructor(sheetFile: string, problem: string) {
    super(`${sheetFile}: ${problem}`);
    this.name = 'SheetError';
  }
}
