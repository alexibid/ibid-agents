import { describe, expect, it } from 'vitest';
import { DatabaseNotInstalledError, settingsFrom } from './database-settings.js';

describe('settingsFrom', () => {
  it('should read the password and the port of the local database', () => {
    const settings = settingsFrom('POSTGRES_PASSWORD=secret-value\nIBID_DATABASE_PORT=54329\n');

    expect(settings).toEqual({ host: '127.0.0.1', port: 54329, user: 'ibid', database: 'ibid_agents', password: 'secret-value' });
  });

  it('should ignore comments and blank lines', () => {
    const settings = settingsFrom('# local only\n\nPOSTGRES_PASSWORD=a=b\nIBID_DATABASE_PORT=5000');

    expect(settings.password).toBe('a=b');
    expect(settings.port).toBe(5000);
  });

  it.each(['', 'IBID_DATABASE_PORT=54329', 'POSTGRES_PASSWORD=x', 'POSTGRES_PASSWORD=x\nIBID_DATABASE_PORT=abc'])(
    'should refuse the incomplete settings "%s"',
    (environmentText) => {
      expect(() => settingsFrom(environmentText)).toThrow(DatabaseNotInstalledError);
    },
  );
});
