import { describe, expect, it } from 'vitest';
import type { ChangedFile } from '../checks/workspace-changes.js';
import { handoverCommands } from './handover-commands.js';

const workspaceRoot = '/work/ibid-workspace';

const changed = (repository: string, file: string, alreadyDirty = false): ChangedFile => ({
  repository,
  file,
  alreadyDirty,
});

describe('handoverCommands', () => {
  it('should give one command per repository, with the folder, the files and the commit line', () => {
    const commands = handoverCommands(
      [{ repository: 'apps/papikapi', line: 'fix(papikapi): filter the diary by date' }],
      [changed('apps/papikapi', 'apps/papikapi/src/app/diary.ts'), changed('apps/papikapi', 'apps/papikapi/src/app/diary.spec.ts')],
      workspaceRoot,
    );

    expect(commands).toEqual([
      "cd '/work/ibid-workspace/apps/papikapi' && git add -- 'src/app/diary.ts' 'src/app/diary.spec.ts' && git commit -m 'fix(papikapi): filter the diary by date'",
    ]);
  });

  it('should put the workspace root last and stage the submodule pointers there', () => {
    const commands = handoverCommands(
      [
        { repository: '.', line: 'chore(workspace): bump ibid-ui and papikapi submodules' },
        { repository: 'libs/ibid-ui', line: 'fix(ibid-ui): add the date chip' },
        { repository: 'apps/papikapi', line: 'fix(papikapi): filter the diary by date' },
      ],
      [changed('libs/ibid-ui', 'libs/ibid-ui/src/lib/atoms/chip.ts'), changed('apps/papikapi', 'apps/papikapi/src/app/diary.ts')],
      workspaceRoot,
    );

    expect(commands.map((command) => command.split(' && ')[0])).toEqual([
      "cd '/work/ibid-workspace/apps/papikapi'",
      "cd '/work/ibid-workspace/libs/ibid-ui'",
      "cd '/work/ibid-workspace'",
    ]);
    expect(commands[2]).toContain("git add -- 'apps/papikapi' 'libs/ibid-ui'");
  });

  it('should leave out a file that already carried earlier work and say so', () => {
    const commands = handoverCommands(
      [{ repository: '.', line: 'fix(tools): correct the runner' }],
      [changed('.', 'tools/qa/check.mjs'), changed('.', 'package.json', true)],
      workspaceRoot,
    );

    expect(commands[0]).toBe("cd '/work/ibid-workspace' && git add -- 'tools/qa/check.mjs' && git commit -m 'fix(tools): correct the runner'");
    expect(commands[1]).toContain('Left out of git add: package.json');
  });

  it('should quote a commit line that contains a quote', () => {
    const commands = handoverCommands(
      [{ repository: '.', line: "fix(tools): keep the user's port" }],
      [changed('.', 'tools/a.mjs')],
      workspaceRoot,
    );

    expect(commands[0]).toContain(String.raw`git commit -m 'fix(tools): keep the user'\''s port'`);
  });
});
