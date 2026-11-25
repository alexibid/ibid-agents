import { describe, expect, it } from 'vitest';
import { CommitCloser, type FinishedStory } from './commit-closer.js';
import { IssueStateReader } from './issue-states.js';
import type { GithubSync, IssueSync } from './issue-sync.js';

const ISSUE = 'https://github.com/demo/site/issues/38';
const EPIC = 'https://github.com/demo/site/issues/36';
const COVER = 'apps/demo/src/cover.ts';
const UPDATED: GithubSync = { state: 'updated', on: '2026-11-24T10:00:00.000Z', detail: 'closed' };

class ClosingSync implements IssueSync {
  readonly closed: string[] = [];

  async show(): Promise<GithubSync> {
    return UPDATED;
  }

  async closeDone(origin: { readonly issue: string }): Promise<GithubSync> {
    this.closed.push(origin.issue);
    return UPDATED;
  }
}

const finished: FinishedStory = { storyId: 'demo-1', issue: ISSUE, epic: EPIC, files: [COVER] };
const listed = (state: string) => async () => [{ number: 38, state, labels: [] }];

function closerWith(issueState: string, uncommitted: readonly string[], sync: ClosingSync): CommitCloser {
  return new CommitCloser({
    finishedStories: () => [finished],
    uncommittedFiles: async () => new Set(uncommitted),
    issueStates: new IssueStateReader(listed(issueState)),
    issues: sync,
  });
}

describe('CommitCloser', () => {
  it('should close the issue of a finished story once all its files are committed', async () => {
    const sync = new ClosingSync();

    const closed = await closerWith('OPEN', [], sync).closeCommitted();

    expect(closed).toEqual(['demo-1']);
    expect(sync.closed).toEqual([ISSUE]);
  });

  it('should wait while a file of the story is still uncommitted', async () => {
    const sync = new ClosingSync();

    await closerWith('OPEN', [COVER], sync).closeCommitted();

    expect(sync.closed).toEqual([]);
  });

  it('should leave an issue that is already closed alone', async () => {
    const sync = new ClosingSync();

    await closerWith('CLOSED', [], sync).closeCommitted();

    expect(sync.closed).toEqual([]);
  });
});
