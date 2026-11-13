import { describe, expect, it } from 'vitest';
import { openingContext } from './opening-context.js';

const workspaceRoot = '/work/ibid-workspace';
const coreRules = '# core rules';

const opening = (sessionDirectory: string) =>
  openingContext({ rawPayload: JSON.stringify({ cwd: sessionDirectory }), workspaceRoot, coreRules });

describe('openingContext', () => {
  it.each([workspaceRoot, `${workspaceRoot}/apps/papikapi`])(
    'should add the assistant and the core rules to a conversation opened in "%s"',
    (sessionDirectory) => {
      const { hookSpecificOutput } = JSON.parse(opening(sessionDirectory));

      expect(hookSpecificOutput.hookEventName).toBe('SessionStart');
      expect(hookSpecificOutput.additionalContext).toContain('`assistente` skill');
      expect(hookSpecificOutput.additionalContext).toContain(coreRules);
    },
  );

  it.each(['/work/ibid-agents', '/work/ibid-workspace-old', ''])(
    'should add nothing to a conversation opened in "%s"',
    (sessionDirectory) => {
      expect(opening(sessionDirectory)).toBe('');
    },
  );

  it('should add nothing when the payload cannot be read', () => {
    expect(openingContext({ rawPayload: 'not json', workspaceRoot, coreRules })).toBe('');
  });

  it('should add nothing when no workspace is configured', () => {
    expect(openingContext({ rawPayload: JSON.stringify({ cwd: '/work' }), workspaceRoot: '', coreRules })).toBe('');
  });
});
