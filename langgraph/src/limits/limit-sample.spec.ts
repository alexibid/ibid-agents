import { describe, expect, it } from 'vitest';
import { samplesOfAntigravitySummary, samplesOfClaudeStatusLine, usedPercentOf } from './limit-sample.js';

describe('usedPercentOf', () => {
  it.each([
    [1, 0],
    [0.32282624, 67.72],
    [0, 100],
    [1.4, 0],
    [-0.2, 100],
  ])('should turn the remaining fraction %d into %d percent used', (remainingFraction, usedPercent) => {
    expect(usedPercentOf(remainingFraction)).toBe(usedPercent);
  });
});

describe('samplesOfAntigravitySummary', () => {
  it('should read one sample per group and window', () => {
    const summary = {
      response: {
        groups: [
          {
            buckets: [
              { bucketId: 'gemini-weekly', window: 'weekly', remainingFraction: 0.25, resetTime: '2026-11-14T17:20:41Z' },
              { bucketId: 'gemini-5h', window: '5h', remainingFraction: 1, resetTime: '2026-11-13T14:26:19Z' },
            ],
          },
          { buckets: [{ bucketId: '3p-weekly', window: 'weekly', remainingFraction: 0.9, resetTime: '2026-11-20T09:26:19Z' }] },
        ],
      },
    };

    expect(samplesOfAntigravitySummary(summary)).toEqual([
      { tool: 'antigravity', pool: 'gemini', window: 'weekly', usedPercent: 75, resetsOn: '2026-11-14T17:20:41Z' },
      { tool: 'antigravity', pool: 'gemini', window: '5h', usedPercent: 0, resetsOn: '2026-11-13T14:26:19Z' },
      { tool: 'antigravity', pool: '3p', window: 'weekly', usedPercent: 10, resetsOn: '2026-11-20T09:26:19Z' },
    ]);
  });

  it.each([undefined, 'text', {}, { response: { groups: [{ buckets: [{ bucketId: 'x-monthly', window: 'monthly', remainingFraction: 1, resetTime: 'x' }] }] } }])(
    'should read nothing from the unexpected answer %j',
    (summary) => {
      expect(samplesOfAntigravitySummary(summary)).toEqual([]);
    },
  );
});

describe('samplesOfClaudeStatusLine', () => {
  it('should read the five hour and the weekly windows', () => {
    const statusLine = {
      rate_limits: {
        five_hour: { used_percentage: 23.456, resets_at: 1738425600 },
        seven_day: { used_percentage: 41.2, resets_at: 1738857600 },
      },
    };

    expect(samplesOfClaudeStatusLine(statusLine)).toEqual([
      { tool: 'claude', pool: 'all models', window: '5h', usedPercent: 23.46, resetsOn: '2025-02-01T16:00:00.000Z' },
      { tool: 'claude', pool: 'all models', window: 'weekly', usedPercent: 41.2, resetsOn: '2025-02-06T16:00:00.000Z' },
    ]);
  });

  it('should read only the window that is present', () => {
    const statusLine = { rate_limits: { seven_day: { used_percentage: 5, resets_at: 1738857600 } } };

    expect(samplesOfClaudeStatusLine(statusLine).map((sample) => sample.window)).toEqual(['weekly']);
  });

  it('should read nothing when Claude sent no limits', () => {
    expect(samplesOfClaudeStatusLine({ model: {} })).toEqual([]);
  });
});
