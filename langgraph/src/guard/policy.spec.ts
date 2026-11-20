import { describe, expect, it } from 'vitest';
import { ruleOn } from './policy.js';

const workspaceRoot = '/work/ibid-workspace';

const reservedPorts = [4200, 4201, 4400, 4401, 6006];

const command = (commandLine: string) => ruleOn({ command: commandLine, filePath: '', workspaceRoot, reservedPorts });
const write = (filePath: string, activeFlow = true) =>
  ruleOn({ command: '', filePath, workspaceRoot, reservedPorts, activeFlow });

describe('ruleOn', () => {
  it.each(['git status', 'git diff --stat', 'git log -5', 'git -C apps/papikapi status --porcelain', 'git branch', 'git show HEAD', 'git worktree list', 'git stash list', 'git fetch -q', 'git -C apps/ibid-website fetch'])(
    'should allow reading git with "%s"',
    (commandLine) => {
      expect(command(commandLine).allowed).toBe(true);
    },
  );

  it.each([
    'git add .',
    'git commit -m "x"',
    'git -C apps/papikapi push',
    'npm run build && git stash',
    'git branch -D old',
    'git checkout main',
    'git submodule update --init',
  ])('should deny changing git state with "%s"', (commandLine) => {
    expect(command(commandLine)).toMatchObject({ allowed: false, rule: 'W36' });
  });

  it('should deny changing git state outside the workspace too', () => {
    expect(command('cd /work/ibid-agents && git commit -m "x"').allowed).toBe(false);
  });

  it.each(['ng serve', 'npx nx serve papikapi', 'npm start', 'npm run storybook:start', 'npx nx serve-static papikapi'])(
    'should deny the server "%s" because it names no port',
    (commandLine) => {
      expect(command(commandLine)).toMatchObject({ allowed: false, rule: 'W34' });
    },
  );

  it.each(['npx nx serve papikapi --port 4401', 'npx nx serve papikapi --port=4200', 'PORT=6006 npm start'])(
    'should deny the server "%s" because its port is reserved',
    (commandLine) => {
      expect(command(commandLine)).toMatchObject({ allowed: false, rule: 'W34' });
    },
  );

  it.each(['npx nx serve papikapi --port 4790', 'npx nx serve-static papikapi --port=4791', 'ng serve --port 4792'])(
    'should allow the server "%s" on a free port',
    (commandLine) => {
      expect(command(commandLine).allowed).toBe(true);
    },
  );

  it('should deny watch mode whatever the port', () => {
    expect(command('npx nx test papikapi --watch')).toMatchObject({ allowed: false, rule: 'W34' });
  });

  it.each(['npx vitest', 'npx vitest run', 'cd apps/papikapi && vitest --ui'])(
    'should deny running vitest directly with "%s"',
    (commandLine) => {
      expect(command(commandLine)).toMatchObject({ allowed: false, rule: 'W05' });
    },
  );

  it.each([
    'cat node_modules/@nx/vitest/package.json',
    'ls libs/utils/vitest.config.mts',
    'grep -rn vitest nx.json',
    'npx nx test papikapi --watch=false',
  ])('should allow "%s", which only mentions the tool', (commandLine) => {
    expect(command(commandLine).allowed).toBe(true);
  });

  it.each(['npx playwright test', 'tsc --noEmit', 'npm run build && npx eslint .'])(
    'should deny the direct tool call "%s"',
    (commandLine) => {
      expect(command(commandLine)).toMatchObject({ allowed: false, rule: 'W05' });
    },
  );

  it.each(['npx nx build papikapi', 'npx nx run-many -t lint', 'npm run check:build', 'ls apps'])(
    'should allow "%s"',
    (commandLine) => {
      expect(command(commandLine).allowed).toBe(true);
    },
  );

  it('should leave tool choice alone in another repository', () => {
    expect(command('cd /work/ibid-agents/langgraph && npx tsc -p tsconfig.json').allowed).toBe(true);
  });

  it('should allow writing inside the workspace when a flow is active', () => {
    expect(write('/work/ibid-workspace/apps/papikapi/src/app/diary.ts', true).allowed).toBe(true);
  });

  it('should deny writing inside the workspace when no LangGraph flow is active', () => {
    expect(write('/work/ibid-workspace/apps/papikapi/src/app/diary.ts', false)).toMatchObject({
      allowed: false,
      rule: 'W60',
    });
  });

  it('should allow writing outside the workspace even when no LangGraph flow is active', () => {
    expect(write('/work/ibid-agents/README.md', false).allowed).toBe(true);
  });
});
