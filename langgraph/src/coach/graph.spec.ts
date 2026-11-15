import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { MemorySaver } from '@langchain/langgraph';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CoachFlow } from '../coach-flow.js';
import { buildCoachGraph } from './graph.js';

const execFileAsync = promisify(execFile);

let workspaceRoot = '';

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: workspaceRoot });
}

beforeEach(async () => {
  workspaceRoot = await mkdtemp(join(tmpdir(), 'coach-graph-'));
  await git(['init']);
  await git(['config', 'user.email', 'test@example.com']);
  await git(['config', 'user.name', 'Test']);
  await mkdir(join(workspaceRoot, 'src/app'), { recursive: true });
  await writeFile(join(workspaceRoot, 'src/app/name.html'), '<div>name</div>\n');
  await writeFile(join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'test', scripts: { build: 'node -e "process.exit(0)"' } }));
  await git(['add', '-A']);
  await git(['commit', '-m', 'init']);
});

afterEach(async () => {
  await rm(workspaceRoot, { recursive: true, force: true });
});

describe('CoachFlow graph', () => {
  it('walks through design-outside-in, author-lesson, student verification, and completion', async () => {
    const flow = new CoachFlow(buildCoachGraph({ contractsDirectory: '/tmp/contracts' }, new MemorySaver()));

    const started = await flow.startCoaching({ goal: 'Add NameInputComponent', workspaceRoot });
    expect(started.status).toBe('designing');
    expect(started.next !== 'nothing' && started.next.step).toBe('design-outside-in');

    const designed = await flow.submit(started.sessionId, {
      inspectedFiles: ['src/app/name.html'],
      templateProblem: 'Monolithic form',
      conceptualTemplate: '<app-name-input [initialData]="nameInitialData()"></app-name-input>',
      scaffoldCommands: [],
    });
    expect(designed.status).toBe('authoring-lesson');
    expect(designed.next !== 'nothing' && designed.next.step).toBe('author-lesson');

    const authored = await flow.submit(started.sessionId, {
      blocks: [
        {
          phase: 'component-declarations',
          targetFile: 'src/app/profile.component.ts',
          problemAndThought: 'Signal holds initial name data.',
          codeSnippet: 'readonly nameInitialData = signal<IName>({ first: "", middle: "", last: "" });',
          symbolRoles: ['signal: reactive Angular 22 state primitive'],
          explanation: 'Declares signal before template binding.',
        },
        {
          phase: 'template-html',
          targetFile: 'src/app/name.html',
          problemAndThought: 'Bind signal to child component.',
          codeSnippet: '<app-name-input [initialData]="nameInitialData()"></app-name-input>',
          symbolRoles: [],
          explanation: 'Consumes signal without async pipe.',
        },
      ],
    });
    expect(authored.status).toBe('awaiting-student');
    expect(authored.lessonBlocks).toHaveLength(2);
    expect(authored.next !== 'nothing' && authored.next.step).toBe('await-student');

    await writeFile(
      join(workspaceRoot, 'src/app/profile.component.ts'),
      "import { signal } from '@angular/core';\nexport class ProfileComponent { readonly nameInitialData = signal({}); }\n",
    );

    const verified = await flow.submit(started.sessionId, {
      action: 'verify-student-code',
      studentFiles: ['src/app/profile.component.ts'],
      verifyBuild: true,
    });
    expect(verified.status).toBe('awaiting-student');

    const completed = await flow.submit(started.sessionId, {
      action: 'complete',
      studentFiles: ['src/app/profile.component.ts'],
      verifyBuild: true,
    });
    expect(completed.status).toBe('finished');
    expect(completed.next).toBe('nothing');
  });
});
