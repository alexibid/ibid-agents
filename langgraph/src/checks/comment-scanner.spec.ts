import { describe, expect, it } from 'vitest';
import { findComments } from './comment-scanner.js';

describe('findComments', () => {
  it('should report a line comment with its line number', () => {
    const comments = findComments('const total = 1;\n// adds things\n');

    expect(comments).toEqual([{ line: 2, text: '// adds things' }]);
  });

  it('should report a block comment once, at the line where it starts', () => {
    const comments = findComments('const a = 1;\n/* first\n second */\nconst b = 2;\n// last\n');

    expect(comments.map(({ line }) => line)).toEqual([2, 5]);
  });

  it('should ignore slashes inside quoted strings', () => {
    expect(findComments("const url = 'http://host//path';\nconst other = \"a /* b */\";\n")).toEqual([]);
  });

  it('should ignore slashes inside template literals and their interpolations', () => {
    expect(findComments('const url = `http://${host}//${`a//b`}`;\n')).toEqual([]);
  });

  it('should ignore slashes inside regular expressions', () => {
    expect(findComments('const pattern = /https?:\\/\\/[^/]+/;\n')).toEqual([]);
    expect(findComments('const pattern = /[/*]+/;\nconst next = 1;\n')).toEqual([]);
  });

  it('should still treat a slash after a value as division', () => {
    expect(findComments('const half = total / 2; // halves\n')).toEqual([{ line: 1, text: '// halves' }]);
  });

  it('should allow the secretlint directive', () => {
    expect(findComments('// secretlint-disable\nconst sample = "x";\n// secretlint-enable\n')).toEqual([]);
  });
});
