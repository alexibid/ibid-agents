import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seoAuditConfigOf } from '../checks/seo/seo-audit-config.js';
import { discoveryOf } from '../domain/discovery.js';
import { parseSheet, SheetReader } from './sheet-reader.js';

const SHEETS = resolve(import.meta.dirname, '..', '..', '..', 'rules', 'projects');
const AGENTS_ROOT = resolve(SHEETS, '..', '..');
const reader = new SheetReader(SHEETS);

const allSheets = async () => Promise.all((await readdir(SHEETS)).map((file) => reader.read(file.replace(/\.md$/, ''))));

describe('discovery in the project sheets', () => {
  it('should classify only the projects whose sheet says so: the website as SEO and the store app as ASO', async () => {
    const classified = (await allSheets()).filter((sheet) => discoveryOf(sheet) !== 'unclassified');

    expect(Object.fromEntries(classified.map((sheet) => [sheet.project, discoveryOf(sheet)]))).toEqual({ 'ibid-website': 'seo', papikapi: 'aso' });
  });

  it('should have a rules document for every discovery and an SEO audit table for every sheet that runs the audit', async () => {
    const sheets = await allSheets();
    const auditing = sheets.filter(({ mandatorySteps }) => mandatorySteps.some(({ step }) => step === 'seo-audit'));

    expect(['seo', 'aso'].filter((discovery) => !existsSync(join(AGENTS_ROOT, 'rules', 'discovery', `${discovery}.md`)))).toEqual([]);
    expect(auditing.map(({ project }) => project)).toEqual(['ibid-website']);
    for (const sheet of auditing) {
      expect(seoAuditConfigOf(await readFile(sheet.sheetFile, 'utf8'), sheet.sheetFile).pages).toBe('dist/ibid-website/browser');
    }
  });

  it('should refuse a sheet whose Discovery is neither seo nor aso', () => {
    const markdown = '| Field | Value |\n| --- | --- |\n| Path | `apps/x` |\n| Nx project | `x` |\n| Commit scope | `x` |\n| Discovery | `web` |\n\n## Mandatory steps\n\n| Step | When |\n| --- | --- |\n| `implement` | `always` |\n';

    expect(() => parseSheet(markdown, 'x.md')).toThrow('x.md: the field "Discovery" must be `seo` or `aso`, not "web"');
  });
});
