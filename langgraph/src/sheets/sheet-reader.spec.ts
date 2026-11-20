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
  '| Reuses | `ibid-ui` |',
  '',
  '## Mandatory steps',
  '',
  '| Step | When |',
  '| --- | --- |',
  '| `plan`, `implement`, `build` | `always` |',
  '| `journey` | `ui` |',
  '',
  '## Triggers',
  '',
  '| Condition | Files |',
  '| --- | --- |',
  '| `figures` | `.glb`, `figures/` |',
  '',
  '## Checks',
  '',
  '| Step | Command |',
  '| --- | --- |',
  '| `build` | `npx nx build demo` |',
].join('\n');

const team = (agentRow: string): string =>
  sheet.replace('| Reuses |', '| Specialist | `agents/demo-specialist.md` |\n| Reuses |') +
  ['', '', '## Agents', '', '| Agent | Step | When | Contract |', '| --- | --- | --- | --- |', agentRow].join('\n');

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

  it('should read the libraries the project reuses', () => {
    expect(parseSheet(sheet, 'demo.md').reuses).toEqual(['ibid-ui']);
  });

  it('should read no reused library and no trigger when the sheet names none', () => {
    const bare = sheet.replace("| Reuses | `ibid-ui` |\n", '').replace(/## Triggers[\s\S]*?(?=## Checks)/, '');

    expect(parseSheet(bare, 'demo.md')).toMatchObject({ reuses: [], triggers: [] });
  });

  it('should read the project-specific triggers', () => {
    expect(parseSheet(sheet, 'demo.md').triggers).toEqual([{ condition: 'figures', patterns: ['.glb', 'figures/'] }]);
  });

  it('should refuse a trigger for an unknown condition', () => {
    expect(() => parseSheet(sheet.replace('| `figures` | `.glb`', '| `models` | `.glb`'), 'demo.md')).toThrow(SheetError);
  });

  it('should read the project specialist and the agents that join each step', () => {
    const parsed = parseSheet(team('| `blender` | `implement` | `figures` | `skills/blender/SKILL.md` |'), 'demo.md');

    expect(parsed.specialist).toBe('agents/demo-specialist.md');
    expect(parsed.agents).toEqual([
      { agent: 'blender', step: 'implement', when: 'figures', contract: 'skills/blender/SKILL.md' },
    ]);
  });

  it('should fall back to the generic specialist and no project agents', () => {
    expect(parseSheet(sheet, 'demo.md')).toMatchObject({ specialist: 'agents/specialist.md', agents: [] });
  });

  it('should refuse an agent that joins a step the sheet never runs', () => {
    expect(() => parseSheet(team('| `critic` | `ux-critique` | `ui` | `agents/ux-critic.md` |'), 'demo.md')).toThrow(
      'the agent "critic" joins "ux-critique", which is not a mandatory step',
    );
  });

  it('should refuse an agent row without a contract', () => {
    expect(() => parseSheet(team('| `blender` | `implement` | `figures` | |'), 'demo.md')).toThrow(SheetError);
  });
});
