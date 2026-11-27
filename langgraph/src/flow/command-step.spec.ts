import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ChangedFile } from '../checks/workspace-changes.js';
import type { ProjectSheet } from '../domain/sheet.js';
import { commandStep, resolveCommand } from './command-step.js';
import { EMPTY_PLAN, NO_ORIGIN, type FlowStateValue } from './state.js';

const UNIT_SPEC = 'apps/demo/src/cover.spec.ts';
const SECOND_SPEC = 'apps/demo/src/banner.spec.ts';
const SOURCE_FILE = 'apps/demo/src/cover.ts';
const MOCK_FILE = 'apps/demo/src/cover.mock.ts';
const E2E_SPEC = 'apps/demo/e2e/cover.spec.ts';
const API_SPEC = 'apps/demo/api/src/cover.spec.ts';

const sheet: ProjectSheet = {
  project: 'demo',
  path: 'apps/demo',
  commitScope: 'demo',
  sheetFile: 'demo.md',
  reuses: [],
  specialist: 'agents/specialist.md',
  agents: [],
  triggers: [],
  mandatorySteps: [],
  commands: {
    'unit-tests': 'npx nx test demo',
    lint: 'npx nx lint demo',
    build: 'npx nx build demo',
  },
};

const change = (file: string): ChangedFile => ({ repository: '.', file, alreadyDirty: false });

const stateWith = (overrides: Partial<FlowStateValue>): FlowStateValue => ({
  story: { project: 'demo', title: 'Cover', criteria: ['Cover works'] },
  origin: NO_ORIGIN,
  epicMembers: [],
  commitRequested: true,
  commitConfirmed: false,
  lastPasses: {},
  sheet,
  baseline: {},
  implementBaseline: undefined,
  contractsDirectory: '/contracts',
  plan: EMPTY_PLAN,
  followUps: [],
  testFiles: [],
  queue: ['build', 'lint', 'unit-tests'],
  position: 0,
  attempts: {},
  status: 'working',
  history: [],
  ...overrides,
});

describe('resolveCommand and commandStep incremental narrowing', () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'cmd-step-'));
    await mkdir(join(root, 'apps/demo/src'), { recursive: true });
    await mkdir(join(root, 'apps/demo/e2e'), { recursive: true });
    await mkdir(join(root, 'apps/demo/api/src'), { recursive: true });
    await writeFile(join(root, UNIT_SPEC), 'export {};');
    await writeFile(join(root, SECOND_SPEC), 'export {};');
    await writeFile(join(root, SOURCE_FILE), 'export {};');
    await writeFile(join(root, MOCK_FILE), 'export {};');
    await writeFile(join(root, E2E_SPEC), 'export {};');
    await writeFile(join(root, API_SPEC), 'export {};');
    await writeFile(
      join(root, 'apps/demo/project.json'),
      JSON.stringify({
        sourceRoot: 'apps/demo/src',
        targets: {
          test: { executor: '@angular/build:unit-test' },
          lint: { executor: '@nx/eslint:lint' },
        },
      }),
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('should narrow nx unit-tests with --include when unit-tests already passed and only unit specs changed', async () => {
    const executed: string[] = [];
    const state = stateWith({ lastPasses: { 'unit-tests': { a: '1' } } });

    const outcome = await commandStep('unit-tests', state, {
      workspaceRoot: root,
      changedSincePass: [change(UNIT_SPEC), change(SECOND_SPEC), change(E2E_SPEC)],
      run: async (command) => {
        executed.push(command);
        return { succeeded: true, outputTail: '' };
      },
    });

    expect(outcome.passed).toBe(true);
    expect(executed).toEqual([`npx nx test demo --include=${UNIT_SPEC} --include=${SECOND_SPEC}`]);
  });

  it('should keep full unit-tests when source files, mocks, or no prior pass exist, or when specs live outside sourceRoot', async () => {
    const withPass = stateWith({ lastPasses: { 'unit-tests': { a: '1' } } });

    expect(await resolveCommand('unit-tests', stateWith({}), { workspaceRoot: root, changedSincePass: [change(UNIT_SPEC)] })).toBe(
      'npx nx test demo',
    );
    expect(await resolveCommand('unit-tests', withPass, { workspaceRoot: root, changedSincePass: [change(UNIT_SPEC), change(SOURCE_FILE)] })).toBe(
      'npx nx test demo',
    );
    expect(await resolveCommand('unit-tests', withPass, { workspaceRoot: root, changedSincePass: [change(MOCK_FILE)] })).toBe(
      'npx nx test demo',
    );
    expect(await resolveCommand('unit-tests', withPass, { workspaceRoot: root, changedSincePass: [change(API_SPEC)] })).toBe(
      'npx nx test demo',
    );
  });

  it('should narrow nx lint with --lintFilePatterns when lint already passed and only leaf spec or e2e files changed', async () => {
    const withLintPass = stateWith({ lastPasses: { lint: { a: '1' } } });

    expect(await resolveCommand('lint', withLintPass, { workspaceRoot: root, changedSincePass: [change(E2E_SPEC), change(UNIT_SPEC)] })).toBe(
      `npx nx lint demo --lintFilePatterns=${E2E_SPEC} --lintFilePatterns=${UNIT_SPEC}`,
    );
    expect(await resolveCommand('lint', withLintPass, { workspaceRoot: root, changedSincePass: [change(SOURCE_FILE)] })).toBe(
      'npx nx lint demo',
    );
  });

  it('should fall back to full command for non-Angular executors or missing files on disk', async () => {
    await writeFile(
      join(root, 'apps/demo/project.json'),
      JSON.stringify({ targets: { test: { executor: 'nx:run-commands' } } }),
    );
    const withPass = stateWith({ lastPasses: { 'unit-tests': { a: '1' } } });

    expect(await resolveCommand('unit-tests', withPass, { workspaceRoot: root, changedSincePass: [change(UNIT_SPEC)] })).toBe(
      'npx nx test demo',
    );

    await writeFile(
      join(root, 'apps/demo/project.json'),
      JSON.stringify({ sourceRoot: 'apps/demo/src', targets: { test: { executor: '@nx/angular:unit-test' } } }),
    );
    expect(
      await resolveCommand('unit-tests', withPass, { workspaceRoot: root, changedSincePass: [change('apps/demo/src/deleted.spec.ts')] }),
    ).toBe('npx nx test demo');
  });
});
