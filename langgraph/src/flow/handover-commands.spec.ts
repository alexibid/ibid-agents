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

  it('should commit a repository outside the workspace in its own folder and never stage it at the root', () => {
    const commands = handoverCommands(
      [
        { repository: '.', line: 'chore(workspace): bump ibid-ui submodule' },
        { repository: 'libs/ibid-ui', line: 'fix(ibid-ui): add the date chip' },
        { repository: '../ibid-agents', line: 'fix(ibid-agents): scope figures to papikapi' },
      ],
      [changed('libs/ibid-ui', 'libs/ibid-ui/src/chip.ts'), changed('../ibid-agents', '../ibid-agents/langgraph/src/plan.ts')],
      workspaceRoot,
    );

    expect(commands).toContain(
      "cd '/work/ibid-agents' && git add -- 'langgraph/src/plan.ts' && git commit -m 'fix(ibid-agents): scope figures to papikapi'",
    );
    expect(commands.at(-1)).toBe(
      "cd '/work/ibid-workspace' && git add -- 'libs/ibid-ui' && git commit -m 'chore(workspace): bump ibid-ui submodule'",
    );
  });

  it('should never hand over a git add with no file when everything the story changed was already dirty', () => {
    const commands = handoverCommands(
      [{ repository: 'apps/ibid-website', line: 'fix(ibid-website): split the site into domains' }],
      [changed('apps/ibid-website', 'apps/ibid-website/src/app/app.routes.ts', true)],
      workspaceRoot,
    );

    expect(commands.some((command) => command.includes('git add -- &&') || command.includes('git add --  &&'))).toBe(false);
    expect(commands[0]).toBe(
      "Nothing in apps/ibid-website can be staged for you: every file this story changed there already had uncommitted work. Stage the story's part by hand, then run: cd '/work/ibid-workspace/apps/ibid-website' && git commit -m 'fix(ibid-website): split the site into domains'",
    );
  });
});

