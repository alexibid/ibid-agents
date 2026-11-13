import { describe, expect, it } from 'vitest';
import { initialStatusOf } from './note.js';

describe('initialStatusOf', () => {
  it.each(['idea', 'plan'] as const)('should keep a new %s open until it is acted on', (kind) => {
    expect(initialStatusOf(kind)).toBe('open');
  });

  it.each(['decision', 'research'] as const)('should file a new %s as done', (kind) => {
    expect(initialStatusOf(kind)).toBe('done');
  });
});
