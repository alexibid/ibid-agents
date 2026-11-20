import { describe, expect, it } from 'vitest';
import { followUpsIn, withoutRepeats } from './follow-ups.js';

describe('followUpsIn', () => {
  it('should keep the follow-ups any agent declares', () => {
    expect(followUpsIn('implement', { summary: 'done', followUps: ['README still names PocketBase'] })).toEqual([
      'README still names PocketBase',
    ]);
  });

  it('should turn the review findings that do not block into follow-ups', () => {
    const evidence = {
      findings: [
        { rule: 'W14', file: 'a.ts', description: 'name hides intent', blocking: false },
        { rule: 'W21', file: 'b.ts', description: 'returns null', blocking: true },
      ],
    };

    expect(followUpsIn('review', evidence)).toEqual(['W14 in a.ts: name hides intent']);
  });

  it('should turn the medium and low UX findings into follow-ups', () => {
    const evidence = {
      findings: [
        { severity: 'low', description: 'label is small', screenshot: 's.png' },
        { severity: 'high', description: 'cannot close', screenshot: 's.png' },
      ],
      screenshots: ['s.png'],
    };

    expect(followUpsIn('ux-critique', evidence)).toEqual(['UX (low): label is small']);
  });

  it('should find nothing in a hand-back that carries none', () => {
    expect(followUpsIn('browser-qa', { verdict: 'pass', findings: ['ok'], screenshots: ['s.png'] })).toEqual([]);
  });
});

describe('withoutRepeats', () => {
  it('should keep each follow-up once, in the order it was first seen', () => {
    expect(withoutRepeats(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});
