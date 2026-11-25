import { describe, expect, it } from 'vitest';
import type { StoryReport } from '../story-flow.js';
import { storiesToSync } from './story-tools.js';

const ISSUE = 'https://github.com/demo/site/issues/42';

const report = (storyId: string, status: StoryReport['status'], issue = ISSUE): StoryReport => ({
  storyId,
  origin: { issue, epic: '' },
  status,
  phase: 'building',
  files: [],
  github: { state: 'not checked', on: '', detail: '' },
  next: 'nothing',
  remainingSteps: [],
  history: [],
  followUps: [],
  recorded: false,
});

describe('storiesToSync', () => {
  it('should let the live story speak for an issue that abandoned stories also point to', () => {
    const chosen = storiesToSync([report('old-1', 'abandoned'), report('live', 'ready-for-commit'), report('old-2', 'abandoned')]);

    expect(chosen.map(({ storyId }) => storyId)).toEqual(['live']);
  });

  it('should still show an abandoned story when nothing else points to its issue', () => {
    expect(storiesToSync([report('old', 'abandoned')]).map(({ storyId }) => storyId)).toEqual(['old']);
  });

  it('should skip a story that has no issue', () => {
    expect(storiesToSync([report('loose', 'working', '')])).toEqual([]);
  });
});
