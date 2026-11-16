import { describe, expect, it } from 'vitest';
import { existsForSignedInUser, githubApiPathOf } from './github-link.js';

describe('githubApiPathOf', () => {
  it.each([
    ['https://github.com/alexibid/services/issues/1', 'repos/alexibid/services/issues/1'],
    ['https://github.com/alexibid/services/pull/7/', 'repos/alexibid/services/issues/7'],
    ['https://github.com/alexibid/services', 'repos/alexibid/services'],
    ['https://github.com/alexibid/services/blob/main/README.md', ''],
    ['https://example.com/alexibid/services/issues/1', ''],
  ])('should map %s to "%s"', (link, path) => {
    expect(githubApiPathOf(new URL(link))).toBe(path);
  });
});

describe('existsForSignedInUser', () => {
  it('should ask GitHub as the signed-in user for an issue link', async () => {
    const asked: string[] = [];
    const found = await existsForSignedInUser(new URL('https://github.com/alexibid/services/issues/1'), async (path) => {
      asked.push(path);
      return true;
    });

    expect(found).toBe(true);
    expect(asked).toEqual(['repos/alexibid/services/issues/1']);
  });

  it('should not ask GitHub about a link it cannot map', async () => {
    const found = await existsForSignedInUser(new URL('https://example.com/page'), async () => true);

    expect(found).toBe(false);
  });
});
