import type { Discovery } from './discovery.js';
import type { ProjectAgent } from './project-team.js';
import type { Condition, StepName } from './steps.js';

export interface MandatoryStep {
  readonly step: StepName;
  readonly when: Condition;
}

export interface ConditionTrigger {
  readonly condition: Condition;
  readonly patterns: readonly string[];
}

export interface ProjectSheet {
  readonly project: string;
  readonly path: string;
  readonly commitScope: string;
  readonly sheetFile: string;
  readonly reuses: readonly string[];
  readonly specialist: string;
  readonly agents: readonly ProjectAgent[];
  readonly triggers: readonly ConditionTrigger[];
  readonly mandatorySteps: readonly MandatoryStep[];
  readonly commands: Readonly<Partial<Record<StepName, string>>>;
  readonly discovery?: Discovery;
}

export class SheetError extends Error {
  constructor(sheetFile: string, problem: string) {
    super(`${sheetFile}: ${problem}`);
    this.name = 'SheetError';
  }
}

const OUTSIDE_WORKSPACE = '../';

export function isOutsideWorkspace(path: string): boolean {
  return path.startsWith(OUTSIDE_WORKSPACE);
}

export function conditionsUsedBy(sheet: ProjectSheet): ReadonlySet<Condition> {
  return new Set(sheet.mandatorySteps.map(({ when }) => when));
}
