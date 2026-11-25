import { describe, expect, it } from 'vitest';
import { EpicProgressReader, EpicUnreadableError, progressFrom } from './epic-progress.js';

const EPIC = 'https://github.com/demo/site/issues/36';
const epicIssue = { title: 'Progressive HTML delivery', sub_issues_summary: { total: 4, completed: 1, percent_completed: 25 } };

describe('progressFrom', () => {
  it('should read the title and how many sub-issues are closed', () => {
    expect(progressFrom(EPIC, epicIssue)).toEqual({ url: EPIC, title: 'Progressive HTML delivery', done: 1, total: 4 });
  });
});

describe('EpicProgressReader', () => {
  it('should ask GitHub once a minute at most for the same epic', async () => {
    const asked: string[] = [];
    let clock = 0;
    const reader = new EpicProgressReader(
      async (apiPath) => {
        asked.push(apiPath);
        return epicIssue;
      },
      () => clock,
    );

    await reader.progressOf(EPIC);
    clock = 30_000;
    await reader.progressOf(EPIC);
    clock = 61_000;
    await reader.progressOf(EPIC);

    expect(asked).toEqual(['repos/demo/site/issues/36', 'repos/demo/site/issues/36']);
  });

  it('should say the epic is unreadable when GitHub does not answer', async () => {
    const reader = new EpicProgressReader(async () => Promise.reject(new Error('offline')));

    await expect(reader.progressOf(EPIC)).rejects.toThrow(EpicUnreadableError);
  });
});
