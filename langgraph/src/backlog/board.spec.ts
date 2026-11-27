import { describe, expect, it } from 'vitest';
import type { StoredEpic, StoredItem } from './backlog-archive.js';
import { boardOf, type IssueState } from './board.js';
import { statesFrom } from './issue-states.js';

const REPO = 'demo/site';
const url = (number: number) => `https://github.com/${REPO}/issues/${number}`;

const item = (fields: Pick<StoredItem, 'key' | 'kind' | 'title' | 'parent' | 'issueUrl'>): StoredItem => ({
  body: '',
  size: 'M',
  repository: REPO,
  issueType: 'Feature',
  labels: [],
  state: fields.issueUrl === '' ? 'draft' : 'published',
  ...fields,
});

const epicWith = (id: string, updatedOn: string, items: readonly StoredItem[]): StoredEpic => ({
  id,
  project: 'site',
  title: id,
  runId: 'run',
  updatedOn,
  items,
});

const bookMotion = epicWith('book-motion', '2026-11-23T10:00:00Z', [
  item({ key: 'Epic', kind: 'epic', title: 'Book reading experience', parent: '', issueUrl: url(50) }),
  item({ key: 'S1', kind: 'story', title: 'Open the book smoothly', parent: 'Epic', issueUrl: url(51) }),
  item({ key: 'S2', kind: 'story', title: 'Close the book smoothly', parent: 'Epic', issueUrl: url(52) }),
  item({ key: 'T1', kind: 'task', title: 'Cover overlay', parent: 'S1', issueUrl: url(53) }),
  item({ key: 'S3', kind: 'story', title: 'Draft idea', parent: 'Epic', issueUrl: '' }),
]);

const states = new Map<string, IssueState>([
  [url(50), { state: 'open', labels: ['epic', 'status: in progress'] }],
  [url(51), { state: 'closed', labels: [] }],
  [url(52), { state: 'open', labels: ['status: ready for commit'] }],
  [url(53), { state: 'closed', labels: [] }],
]);

describe('boardOf', () => {
  it('should show each story as open, closed or draft, with its stage in plain words and its tasks', () => {
    const [board] = boardOf([bookMotion], states);

    expect(board?.stories.map(({ key, state, stage }) => ({ key, state, stage }))).toEqual([
      { key: 'S1', state: 'closed', stage: '' },
      { key: 'S2', state: 'open', stage: 'pronta para commit' },
      { key: 'S3', state: 'draft', stage: '' },
    ]);
    expect(board?.stories[0]?.tasks.map(({ key, state }) => ({ key, state }))).toEqual([{ key: 'T1', state: 'closed' }]);
  });

  it('should count how many stories of the epic are done (closed or ready for commit)', () => {
    const [board] = boardOf([bookMotion], states);

    expect({ done: board?.done, total: board?.total, stage: board?.epic.stage }).toEqual({ done: 2, total: 3, stage: 'em curso' });
  });

  it('should list open epics first, the most recent on top', () => {
    const older = epicWith('older', '2026-11-20T10:00:00Z', [item({ key: 'Epic', kind: 'epic', title: 'Older', parent: '', issueUrl: url(60) })]);
    const closed = epicWith('closed', '2026-11-24T10:00:00Z', [item({ key: 'Epic', kind: 'epic', title: 'Closed', parent: '', issueUrl: url(61) })]);
    const withClosed = new Map([...states, [url(61), { state: 'closed' as const, labels: [] }]]);

    expect(boardOf([older, closed, bookMotion], withClosed).map(({ id }) => id)).toEqual(['book-motion', 'older', 'closed']);
  });
});

describe('statesFrom', () => {
  it('should key each issue by its link, with its state and labels', () => {
    const listed = [{ number: 51, state: 'CLOSED', labels: [{ name: 'user-story' }] }];

    expect(statesFrom(REPO, listed).get(url(51))).toEqual({ state: 'closed', labels: ['user-story'] });
  });
});
