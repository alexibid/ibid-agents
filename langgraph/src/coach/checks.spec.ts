import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceChanges } from '../checks/workspace-changes.js';
import { validateDesign, validateLesson, validateStudentAction } from './checks.js';

const execFileAsync = promisify(execFile);

let workspaceRoot = '';

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: workspaceRoot });
}

beforeEach(async () => {
  workspaceRoot = await mkdtemp(join(tmpdir(), 'coach-checks-'));
  await git(['init']);
  await git(['config', 'user.email', 'test@example.com']);
  await git(['config', 'user.name', 'Test']);
  await mkdir(join(workspaceRoot, 'src/app'), { recursive: true });
  await writeFile(join(workspaceRoot, 'src/app/profile.component.html'), '<div>@if (ready()) { ok }</div>\n');
  await writeFile(join(workspaceRoot, 'src/app/profile.component.ts'), 'export class ProfileComponent {}\n');
  await git(['add', '-A']);
  await git(['commit', '-m', 'init']);
});

afterEach(async () => {
  await rm(workspaceRoot, { recursive: true, force: true });
});

describe('validateDesign', () => {
  it('accepts a valid outside-in read-only design under src/', async () => {
    const baseline = await new WorkspaceChanges(workspaceRoot).fingerprint();
    const verdict = await validateDesign(
      {
        inspectedFiles: ['src/app/profile.component.html'],
        templateProblem: 'Repetitive mat-error markup',
        conceptualTemplate: '<mat-error [appFieldError]="ErrorSets.RequiredText" [input]="first"></mat-error>',
        scaffoldCommands: ['npx ng generate directive common/field-error'],
      },
      workspaceRoot,
      baseline,
    );

    expect(verdict.result.passed).toBe(true);
  });

  it('rejects paths outside src/ or targeting stage projects', async () => {
    const baseline = await new WorkspaceChanges(workspaceRoot).fingerprint();
    const verdict = await validateDesign(
      {
        inspectedFiles: ['projects/stage11/src/app/a.html'],
        templateProblem: 'Stage file',
        conceptualTemplate: '@if (ok()) { <span>ok</span> }',
        scaffoldCommands: [],
      },
      workspaceRoot,
      baseline,
    );

    expect(verdict.result.passed).toBe(false);
    expect(verdict.result.details.some((detail) => detail.includes('stage projects'))).toBe(true);
  });

  it('rejects design if src/ was modified directly', async () => {
    const baseline = await new WorkspaceChanges(workspaceRoot).fingerprint();
    await writeFile(join(workspaceRoot, 'src/app/profile.component.ts'), 'export class Modified {}\n');
    const verdict = await validateDesign(
      {
        inspectedFiles: ['src/app/profile.component.html'],
        templateProblem: 'Problem',
        conceptualTemplate: '<mat-error></mat-error>',
        scaffoldCommands: [],
      },
      workspaceRoot,
      baseline,
    );

    expect(verdict.result.passed).toBe(false);
    expect(verdict.result.details.some((detail) => detail.includes('never edit src/'))).toBe(true);
  });

  it('rejects legacy *ngIf or | async in conceptualTemplate', async () => {
    const baseline = await new WorkspaceChanges(workspaceRoot).fingerprint();
    const verdict = await validateDesign(
      {
        inspectedFiles: ['src/app/profile.component.html'],
        templateProblem: 'Problem',
        conceptualTemplate: '<div *ngIf="user$ | async">Hi</div>',
        scaffoldCommands: [],
      },
      workspaceRoot,
      baseline,
    );

    expect(verdict.result.passed).toBe(false);
    expect(verdict.result.details).toHaveLength(2);
  });
});

describe('validateLesson', () => {
  const validBlock = (overrides: Partial<Record<string, unknown>> = {}) => ({
    phase: 'component-declarations',
    targetFile: 'src/app/profile.component.ts',
    problemAndThought: 'Expose ErrorSets to template first.',
    codeSnippet: 'readonly ErrorSets = ErrorSets',
    symbolRoles: ['ErrorSets: typed constant map of validation keys'],
    explanation: 'Must be public before template binding.',
    ...overrides,
  });

  it('accepts declaration-first sequential blocks without upfront imports', async () => {
    const baseline = await new WorkspaceChanges(workspaceRoot).fingerprint();
    const verdict = await validateLesson(
      {
        blocks: [
          validBlock(),
          validBlock({
            phase: 'template-html',
            targetFile: 'src/app/profile.component.html',
            codeSnippet: '@if (show()) { <mat-error [appFieldError]="ErrorSets.RequiredText"></mat-error> }',
            symbolRoles: [],
          }),
        ],
      },
      workspaceRoot,
      baseline,
    );

    expect(verdict.result.passed).toBe(true);
  });

  it('rejects upfront import statements in code snippets', async () => {
    const baseline = await new WorkspaceChanges(workspaceRoot).fingerprint();
    const verdict = await validateLesson(
      {
        blocks: [
          validBlock({
            codeSnippet: "import { ElementRef } from '@angular/core';\nprivate readonly el = inject(ElementRef);",
          }),
        ],
      },
      workspaceRoot,
      baseline,
    );

    expect(verdict.result.passed).toBe(false);
    expect(verdict.result.details.some((detail) => detail.includes('upfront import'))).toBe(true);
  });

  it('rejects declarations placed after template-html blocks', async () => {
    const baseline = await new WorkspaceChanges(workspaceRoot).fingerprint();
    const verdict = await validateLesson(
      {
        blocks: [
          validBlock({
            phase: 'template-html',
            targetFile: 'src/app/profile.component.html',
            codeSnippet: '<mat-error></mat-error>',
          }),
          validBlock({ phase: 'component-declarations' }),
        ],
      },
      workspaceRoot,
      baseline,
    );

    expect(verdict.result.passed).toBe(false);
    expect(verdict.result.details.some((detail) => detail.includes('declarations must precede template bindings'))).toBe(
      true,
    );
  });

  it('rejects Angular 22 anti-patterns (constructor inject, ngOnDestroy, BehaviorSubject, TS4111)', async () => {
    const baseline = await new WorkspaceChanges(workspaceRoot).fingerprint();
    const verdict = await validateLesson(
      {
        blocks: [
          validBlock({
            phase: 'progressive-logic',
            codeSnippet: [
              'const map: { [key: string]: string[] } = {};',
              'private sub!: Subscription;',
              'private readonly state$ = new BehaviorSubject(false);',
              'constructor(private el: ElementRef = inject(ElementRef)) {}',
              'ngOnDestroy() { this.sub.unsubscribe(); }',
            ].join('\n'),
          }),
        ],
      },
      workspaceRoot,
      baseline,
    );

    expect(verdict.result.passed).toBe(false);
    expect(verdict.result.details.some((detail) => detail.includes('no-loose-index-signature'))).toBe(true);
    expect(verdict.result.details.some((detail) => detail.includes('no-manual-subscription'))).toBe(true);
    expect(verdict.result.details.some((detail) => detail.includes('no-legacy-rxjs-subject'))).toBe(true);
    expect(verdict.result.details.some((detail) => detail.includes('no-constructor-inject'))).toBe(true);
  });
});

describe('validateStudentAction', () => {
  it('validates student code with real imports allowed and Angular 22 invariants enforced', async () => {
    const baseline = await new WorkspaceChanges(workspaceRoot).fingerprint();
    await writeFile(
      join(workspaceRoot, 'src/app/profile.component.ts'),
      [
        "import { Component, inject, signal } from '@angular/core';",
        'export class ProfileComponent {',
        '  readonly nameInitialData = signal({ first: "", middle: "", last: "" });',
        '}',
      ].join('\n'),
    );

    const verdict = await validateStudentAction(
      {
        action: 'verify-student-code',
        studentFiles: ['src/app/profile.component.ts'],
        verifyBuild: false,
      },
      workspaceRoot,
      baseline,
    );

    expect(verdict.result.passed).toBe(true);
  });

  it('flags BehaviorSubject or ngOnDestroy in student code', async () => {
    const baseline = await new WorkspaceChanges(workspaceRoot).fingerprint();
    await writeFile(
      join(workspaceRoot, 'src/app/profile.component.ts'),
      "import { BehaviorSubject } from 'rxjs';\nexport class ProfileComponent { x$ = new BehaviorSubject(''); }\n",
    );

    const verdict = await validateStudentAction(
      {
        action: 'verify-student-code',
        studentFiles: ['src/app/profile.component.ts'],
        verifyBuild: false,
      },
      workspaceRoot,
      baseline,
    );

    expect(verdict.result.passed).toBe(false);
    expect(verdict.result.details.some((detail) => detail.includes('Signals'))).toBe(true);
  });
});
