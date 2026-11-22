import { describe, expect, it } from 'vitest';
import { menuBarTextOf } from './menu-bar';
import type { LimitReading } from './records';

const reading = (fields: Pick<LimitReading, 'tool' | 'pool' | 'window' | 'usedPercent'>): LimitReading => ({
  ...fields,
  resetsOn: '2026-11-14T17:20:41.000Z',
  sampledOn: '2026-11-13T09:41:24.421Z',
  stale: false,
});

describe('menuBarTextOf', () => {
  it('should show the application name while no limit is known', () => {
    expect(menuBarTextOf([])).toBe('ibid');
  });

  it('should show both windows of both tools, rounded without decimals', () => {
    const text = menuBarTextOf([
      reading({ tool: 'antigravity', pool: 'gemini', window: 'weekly', usedPercent: 67.72 }),
      reading({ tool: 'antigravity', pool: 'gemini', window: '5h', usedPercent: 0 }),
      reading({ tool: 'claude', pool: 'all models', window: '5h', usedPercent: 23.4 }),
      reading({ tool: 'claude', pool: 'all models', window: 'weekly', usedPercent: 41.2 }),
    ]);

    expect(text).toBe('Claude 5h 23% sem 41% · Antigravity 5h 0% sem 68%');
  });

  it('should show the most spent group when a tool has several', () => {
    const text = menuBarTextOf([
      reading({ tool: 'antigravity', pool: 'gemini', window: 'weekly', usedPercent: 67.72 }),
      reading({ tool: 'antigravity', pool: '3p', window: 'weekly', usedPercent: 12 }),
      reading({ tool: 'antigravity', pool: 'gemini-argon-wtu', window: 'weekly', usedPercent: 9.84 }),
    ]);

    expect(text).toBe('Antigravity sem 68%');
  });

  it('should say a tool has no fresh reading instead of showing its old figures', () => {
    const text = menuBarTextOf([
      { ...reading({ tool: 'antigravity', pool: 'gemini', window: 'weekly', usedPercent: 33.6 }), stale: true },
      reading({ tool: 'claude', pool: 'all models', window: '5h', usedPercent: 23.4 }),
    ]);

    expect(text).toBe('Claude 5h 23% · Antigravity sem leitura');
  });
});
