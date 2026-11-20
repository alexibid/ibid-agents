import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SheetError, type ConditionTrigger, type MandatoryStep, type ProjectSheet } from '../domain/sheet.js';
import { GENERIC_SPECIALIST, type ProjectAgent, type TeamStep } from '../domain/project-team.js';
import { isCondition, isStepName, kindOf, type Condition, type StepName } from '../domain/steps.js';
import { codeSpans, rowsBeforeFirstHeading, rowsUnderHeading, type TableRow } from './markdown-tables.js';

const PLAN_STEP = 'plan';
const REUSES_FIELD = 'Reuses';
const SPECIALIST_FIELD = 'Specialist';

export interface SheetSource {
  read(project: string): Promise<ProjectSheet>;
}

export class SheetReader implements SheetSource {
  constructor(private readonly projectsDirectory: string) {}

  async read(project: string): Promise<ProjectSheet> {
    const sheetFile = join(this.projectsDirectory, `${project}.md`);
    const markdown = await this.load(sheetFile, project);
    const sheet = parseSheet(markdown, sheetFile);
    assertCommandsCoverSteps(sheet);
    return sheet;
  }

  private async load(sheetFile: string, project: string): Promise<string> {
    try {
      return await readFile(sheetFile, 'utf8');
    } catch {
      throw new SheetError(sheetFile, `no sheet exists for project "${project}"`);
    }
  }
}

export function parseSheet(markdown: string, sheetFile: string): ProjectSheet {
  const identityRows = rowsBeforeFirstHeading(markdown);
  const fields = fieldsOf(identityRows);
  const sheet: ProjectSheet = {
    project: requiredField(fields, 'Nx project', sheetFile),
    path: requiredField(fields, 'Path', sheetFile),
    commitScope: requiredField(fields, 'Commit scope', sheetFile),
    sheetFile,
    reuses: reusedLibrariesOf(identityRows),
    specialist: fields.get(SPECIALIST_FIELD) ?? GENERIC_SPECIALIST,
    agents: agentsOf(rowsUnderHeading(markdown, 'Agents'), sheetFile),
    triggers: triggersOf(rowsUnderHeading(markdown, 'Triggers'), sheetFile),
    mandatorySteps: mandatoryStepsOf(rowsUnderHeading(markdown, 'Mandatory steps'), sheetFile),
    commands: commandsOf(rowsUnderHeading(markdown, 'Checks'), sheetFile),
  };
  assertAgentsJoinMandatorySteps(sheet);
  return sheet;
}

function fieldsOf(rows: readonly TableRow[]): Map<string, string> {
  const fields = new Map<string, string>();
  for (const [name, value] of rows) {
    const code = codeSpans(value ?? '')[0];
    if (name !== undefined && code !== undefined) {
      fields.set(name, code);
    }
  }
  return fields;
}

function requiredField(fields: ReadonlyMap<string, string>, name: string, sheetFile: string): string {
  const value = fields.get(name);
  if (value === undefined) {
    throw new SheetError(sheetFile, `the field "${name}" is missing from the first table`);
  }
  return value;
}

function reusedLibrariesOf(rows: readonly TableRow[]): string[] {
  const reusesRow = rows.find(([name]) => name === REUSES_FIELD);
  return codeSpans(reusesRow?.[1] ?? '');
}

function triggersOf(rows: readonly TableRow[], sheetFile: string): ConditionTrigger[] {
  return rows.map(([conditionCell, filesCell]) => ({
    condition: knownCondition(codeSpans(conditionCell ?? '')[0] ?? '', 'Triggers', sheetFile),
    patterns: codeSpans(filesCell ?? ''),
  }));
}

function agentsOf(rows: readonly TableRow[], sheetFile: string): ProjectAgent[] {
  return rows.map(([agentCell, stepCell, whenCell, contractCell]) => ({
    agent: requiredCode(agentCell, 'Agent', sheetFile),
    step: knownTeamStep(requiredCode(stepCell, 'Step', sheetFile), sheetFile),
    when: knownCondition(codeSpans(whenCell ?? '')[0] ?? '', 'Agents', sheetFile),
    contract: requiredCode(contractCell, 'Contract', sheetFile),
  }));
}

function requiredCode(cell: string | undefined, column: string, sheetFile: string): string {
  const code = codeSpans(cell ?? '')[0];
  if (code === undefined) {
    throw new SheetError(sheetFile, `a row of "Agents" has no \`${column}\``);
  }
  return code;
}

function knownTeamStep(step: string, sheetFile: string): TeamStep {
  return step === PLAN_STEP ? PLAN_STEP : knownStep(step, sheetFile);
}

function mandatoryStepsOf(rows: readonly TableRow[], sheetFile: string): MandatoryStep[] {
  if (rows.length === 0) {
    throw new SheetError(sheetFile, 'the "Mandatory steps" table is missing or empty');
  }
  return rows.flatMap(([stepsCell, whenCell]) => {
    const when = knownCondition(codeSpans(whenCell ?? '')[0] ?? '', 'Mandatory steps', sheetFile);
    return codeSpans(stepsCell ?? '')
      .filter((step) => step !== PLAN_STEP)
      .map((step) => ({ step: knownStep(step, sheetFile), when }));
  });
}

function commandsOf(rows: readonly TableRow[], sheetFile: string): Partial<Record<StepName, string>> {
  const commands: Partial<Record<StepName, string>> = {};
  for (const [stepCell, commandCell] of rows) {
    const step = codeSpans(stepCell ?? '')[0];
    const command = codeSpans(commandCell ?? '')[0];
    if (step !== undefined && command !== undefined) {
      commands[knownStep(step, sheetFile)] = command;
    }
  }
  return commands;
}

function knownCondition(condition: string, table: string, sheetFile: string): Condition {
  if (!isCondition(condition)) {
    throw new SheetError(sheetFile, `unknown condition "${condition}" in "${table}"`);
  }
  return condition;
}

function knownStep(step: string, sheetFile: string): StepName {
  if (!isStepName(step)) {
    throw new SheetError(sheetFile, `unknown step "${step}"`);
  }
  return step;
}

function assertAgentsJoinMandatorySteps(sheet: ProjectSheet): void {
  const steps = new Set(sheet.mandatorySteps.map(({ step }) => step));
  for (const { agent, step } of sheet.agents) {
    if (step !== PLAN_STEP && !steps.has(step)) {
      throw new SheetError(sheet.sheetFile, `the agent "${agent}" joins "${step}", which is not a mandatory step`);
    }
  }
}

function assertCommandsCoverSteps(sheet: ProjectSheet): void {
  for (const { step } of sheet.mandatorySteps) {
    if (kindOf(step) === 'command' && sheet.commands[step] === undefined) {
      throw new SheetError(sheet.sheetFile, `the mandatory step "${step}" has no command under "Checks"`);
    }
  }
}
