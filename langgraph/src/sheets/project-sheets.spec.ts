import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { judgePlan, type Plan } from '../domain/plan.js';
import { SheetReader } from './sheet-reader.js';

const SHEETS = resolve(import.meta.dirname, '..', '..', '..', 'rules', 'projects');
const reader = new SheetReader(SHEETS);
const AGENTS_ROOT = resolve(SHEETS, '..', '..');

const allSheets = async () =>
  Promise.all((await readdir(SHEETS)).map((file) => reader.read(file.replace(/\.md$/, ''))));

const codePlan = (files: readonly string[]): Plan => ({ files, conditions: [], journey: '', reusedParts: [], brief: '' });

describe('the project sheets', () => {
  it('should all parse', async () => {
    const projects = (await readdir(SHEETS)).map((file) => file.replace(/\.md$/, ''));

    await Promise.all(projects.map((project) => expect(reader.read(project)).resolves.toBeDefined()));
  });

  it('should have a sheet for ibid-agents, outside the workspace', async () => {
    const sheet = await reader.read('ibid-agents');

    expect(sheet).toMatchObject({ project: 'ibid-agents', path: '../ibid-agents', commitScope: 'ibid-agents' });
    expect(sheet.sheetFile).toBe(join(SHEETS, 'ibid-agents.md'));
  });

  it('should accept an ibid-website plan with a code file in a models folder without figures', async () => {
    const sheet = await reader.read('ibid-website');
    const plan = codePlan(['apps/ibid-website/src/app/domain/models/cover-motion.model.ts']);

    expect(judgePlan(plan, sheet)).toEqual({ accepted: true, problems: [] });
  });

  it('should accept a papikapi plan with a code model without figures', async () => {
    const sheet = await reader.read('papikapi');

    expect(judgePlan(codePlan(['apps/papikapi/src/app/domain/models/figure.model.ts']), sheet).accepted).toBe(true);
  });

  it('should still require figures for a papikapi plan with a real figure file', async () => {
    const sheet = await reader.read('papikapi');
    const verdict = judgePlan(codePlan(['apps/papikapi/public/figures/cat.glb']), sheet);

    expect(verdict.problems).toContain('The planned files require the condition "figures", which the plan does not declare.');
  });

  it('should keep figures to the papikapi family', async () => {
    const projects = (await readdir(SHEETS)).map((file) => file.replace(/\.md$/, ''));
    const sheets = await Promise.all(projects.map((project) => reader.read(project)));
    const withFigures = sheets.filter(({ triggers }) => triggers.some(({ condition }) => condition === 'figures'));

    expect(withFigures.map(({ project }) => project).sort()).toEqual(['papikapi', 'papikapi-api', 'papikapi-studio']);
  });

  it('should not ask ibid-website for an ibid-ui reuse search', async () => {
    expect((await reader.read('ibid-website')).reuses).toEqual([]);
  });

  it('should point every specialist and project agent at a contract that exists', async () => {
    const contracts = (await allSheets()).flatMap(({ specialist, agents }) => [specialist, ...agents.map(({ contract }) => contract)]);

    expect(contracts.filter((contract) => !existsSync(join(AGENTS_ROOT, contract)))).toEqual([]);
  });

  it('should give every app its own specialist', async () => {
    const sheets = await allSheets();
    const generic = sheets.filter(({ path, specialist }) => path.startsWith('apps/') && specialist === 'agents/specialist.md');

    expect(generic.map(({ project }) => project)).toEqual([]);
  });
});
