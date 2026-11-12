import type { ProjectSheet } from './sheet.js';
import { inCanonicalOrder, type Condition, type StepName } from './steps.js';

export interface Story {
  readonly project: string;
  readonly title: string;
  readonly criteria: readonly string[];
}

export interface Plan {
  readonly files: readonly string[];
  readonly conditions: readonly Condition[];
  readonly journey: string;
  readonly reusedParts: readonly string[];
  readonly brief: string;
}

export interface PlanVerdict {
  readonly accepted: boolean;
  readonly problems: readonly string[];
}

const UI_FILE = /\.(html|scss|css|svg)$|\.stories\.ts$|\/ui\/|\/atoms\/|\/molecules\/|\/organisms\/|\/templates\//;
const FIGURE_FILE = /\.(glb|gltf|blend|obj)$|\/figures?\/|\/models?\//;
const WORKFLOW_FILE = /^\.github\//;

export function conditionsOfFiles(files: readonly string[]): Condition[] {
  const conditions: Condition[] = ['always'];
  if (files.some((file) => UI_FILE.test(file))) {
    conditions.push('ui');
  }
  if (files.some((file) => FIGURE_FILE.test(file))) {
    conditions.push('figures');
  }
  if (files.some((file) => WORKFLOW_FILE.test(file))) {
    conditions.push('workflows');
  }
  return conditions;
}

export function judgePlan(plan: Plan, sheet: ProjectSheet): PlanVerdict {
  const problems = [
    ...missingFiles(plan),
    ...undeclaredConditions(plan),
    ...missingJourney(plan, sheet),
    ...missingReuseSearch(plan),
  ];
  return { accepted: problems.length === 0, problems };
}

export function stepQueue(sheet: ProjectSheet, conditions: readonly Condition[]): StepName[] {
  const active = new Set<Condition>(['always', ...conditions]);
  const steps = sheet.mandatorySteps.filter(({ when }) => active.has(when)).map(({ step }) => step);
  return inCanonicalOrder(steps);
}

function missingFiles(plan: Plan): string[] {
  return plan.files.length === 0 ? ['The plan names no file to create or change.'] : [];
}

function undeclaredConditions(plan: Plan): string[] {
  const declared = new Set<Condition>(plan.conditions);
  return conditionsOfFiles(plan.files)
    .filter((condition) => condition !== 'always' && !declared.has(condition))
    .map((condition) => `The planned files require the condition "${condition}", which the plan does not declare.`);
}

function missingJourney(plan: Plan, sheet: ProjectSheet): string[] {
  const needsJourney = stepQueue(sheet, plan.conditions).includes('journey');
  return needsJourney && plan.journey.trim() === ''
    ? ['This plan includes the journey step but names no journey.']
    : [];
}

function missingReuseSearch(plan: Plan): string[] {
  const touchesInterface = plan.conditions.includes('ui');
  return touchesInterface && plan.reusedParts.length === 0
    ? ['The plan touches the interface but lists no ibid-ui part that was considered for reuse.']
    : [];
}
