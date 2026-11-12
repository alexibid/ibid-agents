import { describe, expect, it } from 'vitest';
import { SheetError } from '../domain/sheet.js';
import { parseSheet } from './sheet-reader.js';

const sheet = [
  '# demo',
  '',
  '| Field | Value |',
  '| --- | --- |',
  '| Path | `apps/demo` |',
  '| Nx project | `demo` |',
  '| Commit scope | `demo` |',
  '',
  '## Mandatory steps',
  '',
  '| Step | When |',
  '| --- | --- |',
  '| `plan`, `implement`, `build` | `always` |',
  '| `journey` | `ui` |',
  '',
  '## Checks',
  '',
  '| Step | Command |',
  '| --- | --- |',
  '| `build` | `npx nx build demo` |',
].join('\n');

describe('parseSheet', () => {
  it('should read the identity fields from the first table', () => {
    const parsed = parseSheet(sheet, 'demo.md');

    expect(parsed).toMatchObject({ project: 'demo', path: 'apps/demo', commitScope: 'demo' });
  });

  it('should read each mandatory step with its condition and leave the plan step out', () => {
    expect(parseSheet(sheet, 'demo.md').mandatorySteps).toEqual([
      { step: 'implement', when: 'always' },
      { step: 'build', when: 'always' },
      { step: 'journey', when: 'ui' },
    ]);
  });

  it('should read the command of each check', () => {
    expect(parseSheet(sheet, 'demo.md').commands).toEqual({ build: 'npx nx build demo' });
  });

  it('should refuse a sheet that names an unknown step', () => {
    expect(() => parseSheet(sheet.replace('`journey`', '`deploy`'), 'demo.md')).toThrow(SheetError);
  });

  it('should refuse a sheet with no mandatory steps', () => {
    expect(() => parseSheet(sheet.replace('## Mandatory steps', '## Other'), 'demo.md')).toThrow(SheetError);
  });

  it('should refuse a sheet that lacks an identity field', () => {
    expect(() => parseSheet(sheet.replace('| Nx project | `demo` |\n', ''), 'demo.md')).toThrow(SheetError);
  });
});
