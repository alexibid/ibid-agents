import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProjectSheet } from '../domain/sheet.js';
import { checkRules } from './rule-checks.js';

const TEMPLATE = 'apps/demo/src/form.html';

const sheet = (reuses: readonly string[]): ProjectSheet => ({
  project: 'demo',
  path: 'apps/demo',
  commitScope: 'demo',
  sheetFile: 'demo.md',
  reuses,
  specialist: 'agents/specialist.md',
  agents: [],
  triggers: [],
  mandatorySteps: [{ step: 'implement', when: 'always' }],
  commands: {},
});

describe('checkRules', () => {
  let workspaceRoot = '';

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'rule-checks-'));
    await mkdir(join(workspaceRoot, 'apps/demo/src'), { recursive: true });
    await writeFile(join(workspaceRoot, TEMPLATE), '<button>Send</button>\n');
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('should flag a native element in a project that reuses a design system', async () => {
    const violations = await checkRules([TEMPLATE], { workspaceRoot, sheet: sheet(['ibid-ui']) });

    expect(violations.map(({ rule }) => rule)).toEqual(['W09']);
  });

  it('should allow a native element in a project that reuses no design system', async () => {
    expect(await checkRules([TEMPLATE], { workspaceRoot, sheet: sheet([]) })).toEqual([]);
  });
});
