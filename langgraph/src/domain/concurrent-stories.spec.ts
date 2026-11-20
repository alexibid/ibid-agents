import { describe, expect, it } from 'vitest';
import { clashesWith, ownChanges } from './concurrent-stories.js';

const encoding = { storyId: 'ibid-website-encoding', files: ['apps/site/content.utils.ts', 'apps/site/project.json'] };

describe('clashesWith', () => {
  it('should name every planned file another story in progress already owns', () => {
    expect(clashesWith(['apps/site/cover.ts', 'apps/site/project.json'], [encoding])).toEqual([
      'apps/site/project.json already belongs to the story ibid-website-encoding, which is in progress. Plan a different focus.',
    ]);
  });

  it('should find no clash between stories with different focuses', () => {
    expect(clashesWith(['apps/site/cover.ts'], [encoding])).toEqual([]);
  });
});

describe('ownChanges', () => {
  const change = (file: string) => ({ file });

  it('should leave out what another story in progress planned', () => {
    const changes = [change('apps/site/cover.ts'), change('apps/site/content.utils.ts'), change('apps/site/stray.ts')];

    expect(ownChanges(changes, ['apps/site/cover.ts'], [encoding]).map(({ file }) => file)).toEqual([
      'apps/site/cover.ts',
      'apps/site/stray.ts',
    ]);
  });

  it('should keep a file both stories planned', () => {
    expect(ownChanges([change('apps/site/project.json')], ['apps/site/project.json'], [encoding])).toHaveLength(1);
  });
});
