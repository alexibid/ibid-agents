import { describe, expect, it } from 'vitest';
import { openingContext, sessionDirectoryOf, watchesDirectory } from './opening-context.js';

const workspaceRoot = '/work/ibid-workspace';
const agentsRoot = '/work/ibid-agents';
const coreRules = '# core rules';
const pullNotice = 'PENDING PULLS';

const opening = (sessionDirectory: string, notice = '') =>
  openingContext({ sessionDirectory, workspaceRoot, agentsRoot, coreRules, pullNotice: notice });

const contextOf = (output: string): string => JSON.parse(output).hookSpecificOutput.additionalContext;

describe('openingContext', () => {
  it.each([workspaceRoot, `${workspaceRoot}/apps/papikapi`])(
    'should add the assistant and the core rules to a conversation opened in "%s"',
    (sessionDirectory) => {
      const { hookSpecificOutput } = JSON.parse(opening(sessionDirectory));

      expect(hookSpecificOutput.hookEventName).toBe('SessionStart');
      expect(hookSpecificOutput.additionalContext).toContain('`assistant` skill');
      expect(hookSpecificOutput.additionalContext).toContain(coreRules);
    },
  );

  it('should put the pending pulls before everything else in the workspace', () => {
    expect(contextOf(opening(workspaceRoot, pullNotice)).startsWith(pullNotice)).toBe(true);
  });

  it('should add only the pending pulls to a conversation opened in the agents repository', () => {
    expect(contextOf(opening(`${agentsRoot}/langgraph`, pullNotice))).toBe(pullNotice);
  });

  it('should add nothing to the agents repository when nothing is behind', () => {
    expect(opening(agentsRoot)).toBe('');
  });

  it.each(['/work/ibid-workspace-old', '/work/other', ''])(
    'should add nothing to a conversation opened in "%s"',
    (sessionDirectory) => {
      expect(opening(sessionDirectory, pullNotice)).toBe('');
    },
  );

  it('should add nothing when no workspace is configured', () => {
    expect(
      openingContext({ sessionDirectory: '/work', workspaceRoot: '', agentsRoot: '', coreRules, pullNotice }),
    ).toBe('');
  });
});

describe('sessionDirectoryOf', () => {
  it('should read the directory from the payload', () => {
    expect(sessionDirectoryOf(JSON.stringify({ cwd: workspaceRoot }))).toBe(workspaceRoot);
  });

  it('should read nothing when the payload cannot be read', () => {
    expect(sessionDirectoryOf('not json')).toBe('');
  });
});

describe('watchesDirectory', () => {
  it.each([
    [workspaceRoot, true],
    [`${agentsRoot}/skills`, true],
    ['/work/other', false],
  ])('should watch "%s": %s', (sessionDirectory, watched) => {
    expect(watchesDirectory({ sessionDirectory, workspaceRoot, agentsRoot })).toBe(watched);
  });
});
