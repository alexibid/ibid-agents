import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SheetError, type MandatoryStep, type ProjectSheet } from '../domain/sheet.js';
import { isCondition, isStepName, kindOf, type StepName } from '../domain/steps.js';
import { codeSpans, rowsBeforeFirstHeading, rowsUnderHeading, type TableRow } from './markdown-tables.js';

const PLAN_STEP = 'plan';

export class SheetReader {
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
  const fields = fieldsOf(rowsBeforeFirstHeading(markdown));
  return {
    project: requiredField(fields, 'Nx project', sheetFile),
    path: requiredField(fields, 'Path', sheetFile),
    commitScope: requiredField(fields, 'Commit scope', sheetFile),
    sheetFile,
    mandatorySteps: mandatoryStepsOf(rowsUnderHeading(markdown, 'Mandatory steps'), sheetFile),
    commands: commandsOf(rowsUnderHeading(markdown, 'Checks'), sheetFile),
  };
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

function mandatoryStepsOf(rows: readonly TableRow[], sheetFile: string): MandatoryStep[] {
  if (rows.length === 0) {
    throw new SheetError(sheetFile, 'the "Mandatory steps" table is missing or empty');
  }
  return rows.flatMap(([stepsCell, whenCell]) => {
    const when = codeSpans(whenCell ?? '')[0] ?? '';
    if (!isCondition(when)) {
      throw new SheetError(sheetFile, `unknown condition "${when}" in "Mandatory steps"`);
    }
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

function knownStep(step: string, sheetFile: string): StepName {
  if (!isStepName(step)) {
    throw new SheetError(sheetFile, `unknown step "${step}"`);
  }
  return step;
}

function assertCommandsCoverSteps(sheet: ProjectSheet): void {
  for (const { step } of sheet.mandatorySteps) {
    if (kindOf(step) === 'command' && sheet.commands[step] === undefined) {
      throw new SheetError(sheet.sheetFile, `the mandatory step "${step}" has no command under "Checks"`);
    }
  }
}
