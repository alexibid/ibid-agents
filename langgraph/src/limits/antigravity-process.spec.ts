import { describe, expect, it } from 'vitest';
import { languageServerProcessIdsIn, sessionKeyIn } from './antigravity-process.js';

describe('languageServerProcessIdsIn', () => {
  it('should find every language server, even under an application path with spaces', () => {
    const processList = [
      '  101 /Applications/Antigravity.app/Contents/Resources/bin/language_server --standalone --https_server_port',
      '  202 /Applications/Antigravity IDE.app/Contents/Resources/bin/language_server --enable_sidecars',
      '  303 /Applications/Antigravity.app/Contents/MacOS/Electron',
    ].join('\n');

    expect(languageServerProcessIdsIn(processList)).toEqual(['101', '202']);
  });

  it('should ignore commands that only mention the language server', () => {
    const processList = [
      '  404 /bin/zsh -c grep /Applications/Antigravity.app/Contents/Resources/bin/language_server --csrf_token',
      '  505 /usr/bin/pgrep -f Contents/Resources/bin/language_server',
      '  606 grep language_server',
    ].join('\n');

    expect(languageServerProcessIdsIn(processList)).toEqual([]);
  });
});

describe('sessionKeyIn', () => {
  it('should read the key from the command line flag of older versions', () => {
    expect(sessionKeyIn('/bin/language_server --csrf_token fake-flag-key --port 1')).toBe('fake-flag-key');
  });

  it('should read the key from the environment when the version passes it there', () => {
    const command = '/bin/language_server --read_host_bridge_token_from_stdin HOME=/Users/me ANTIGRAVITY_SERVER_CSRF_TOKEN=fake-env-key';

    expect(sessionKeyIn(command)).toBe('fake-env-key');
  });

  it('should give no key when neither place carries one', () => {
    expect(sessionKeyIn('/bin/language_server --standalone HOME=/Users/me')).toBeUndefined();
  });
});
