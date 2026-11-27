import { describe, expect, it } from 'vitest';
import { EpicProgressReader, EpicUnreadableError, progressFrom } from './epic-progress.js';

const EPIC = 'https://github.com/demo/site/issues/36';
const epicIssue = { title: 'Progressive HTML delivery', sub_issues_summary: { total: 4, completed: 1, percent_completed: 25 } };

describe('progressFrom', () => {
  it('should read the title and how many sub-issues are closed when sub-issues are absent', () => {
    expect(progressFrom(EPIC, epicIssue)).toEqual({ url: EPIC, title: 'Progressive HTML delivery', done: 1, total: 4 });
  });

  it('should count built stories (ready for commit, verifying, awaiting commit) as done alongside closed ones', () => {
    const subIssues = [
      { state: 'closed', labels: [] },
      { state: 'open', labels: [{ name: 'status: ready for commit' }] },
      { state: 'open', labels: [{ name: 'status: verifying' }] },
      { state: 'open', labels: [{ name: 'status: building' }] },
    ];
    expect(progressFrom(EPIC, epicIssue, subIssues)).toEqual({ url: EPIC, title: 'Progressive HTML delivery', done: 3, total: 4 });
  });
});

describe('EpicProgressReader', () => {
  it('should ask GitHub once a minute at most for the same epic', async () => {
    const asked: string[] = [];
    let clock = 0;
    const reader = new EpicProgressReader(
      async (apiPath) => {
        asked.push(apiPath);
        return apiPath.endsWith('/sub_issues?per_page=100') ? [] : epicIssue;
      },
      () => clock,
    );

    await reader.progressOf(EPIC);
    clock = 30_000;
    await reader.progressOf(EPIC);
    clock = 61_000;
    await reader.progressOf(EPIC);

    expect(asked).toEqual([
      'repos/demo/site/issues/36',
      'repos/demo/site/issues/36/sub_issues?per_page=100',
      'repos/demo/site/issues/36',
      'repos/demo/site/issues/36/sub_issues?per_page=100',
    ]);
  });

  it('should say the epic is unreadable when GitHub does not answer', async () => {
    const reader = new EpicProgressReader(async () => Promise.reject(new Error('offline')));

    await expect(reader.progressOf(EPIC)).rejects.toThrow(EpicUnreadableError);
  });
});
