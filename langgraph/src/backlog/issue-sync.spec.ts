import { describe, expect, it } from 'vitest';
import { STATUS_MARKER } from './issue-stage.js';
import { GithubIssueSync, type Gh } from './issue-sync.js';

const origin = { issue: 'https://github.com/demo/site/issues/38', epic: 'https://github.com/demo/site/issues/36' };
const ON = new Date('2026-11-23T10:40:00Z');

class FakeGh {
  readonly calls: string[][] = [];
  labels: string[] = [];
  comments: object[] = [];
  epicSummary = { total: 4, completed: 1 };
  failWith = '';

  readonly gh: Gh = async (args) => {
    if (this.failWith !== '') {
      throw new Error(this.failWith);
    }
    this.calls.push([...args]);
    const path = args[0] === 'api' ? (args.at(-1) ?? '') : '';
    if (path.endsWith('/comments?per_page=100')) {
      return JSON.stringify(this.comments);
    }
    if (path.endsWith('/issues/36')) {
      return JSON.stringify({ labels: [], sub_issues_summary: this.epicSummary });
    }
    if (path.endsWith('/issues/38')) {
      return JSON.stringify({ labels: this.labels.map((name) => ({ name })) });
    }
    return '';
  };

  edits(): string[][] {
    return this.calls.filter((call) => call[0] === 'issue');
  }
}

const syncOver = (fake: FakeGh) => new GithubIssueSync(fake.gh, () => ON);

describe('GithubIssueSync.show', () => {
  it('should move the story label to the new stage and mark the epic as in progress', async () => {
    const fake = new FakeGh();
    fake.labels = ['user-story', 'status: building'];

    const synced = await syncOver(fake).show(origin, 'ready-for-commit');

    expect(synced).toEqual({ state: 'updated', on: ON.toISOString(), detail: 'issue #38 shows "ready-for-commit"' });
    expect(fake.edits()).toContainEqual([
      'issue', 'edit', '38', '-R', 'demo/site', '--add-label', 'status: ready for commit', '--remove-label', 'status: building',
    ]);
    expect(fake.edits()).toContainEqual(['issue', 'edit', '36', '-R', 'demo/site', '--add-label', 'status: in progress']);
  });

  it('should edit the one status comment instead of adding another', async () => {
    const fake = new FakeGh();
    fake.comments = [{ id: 7, body: `old status\n${STATUS_MARKER}` }];

    await syncOver(fake).show(origin, 'verifying');

    const patch = fake.calls.find((call) => call.includes('PATCH'));
    expect(patch?.slice(0, 4)).toEqual(['api', '-X', 'PATCH', 'repos/demo/site/issues/comments/7']);
    expect(fake.edits().some((call) => call[1] === 'comment')).toBe(false);
  });

  it('should say the update failed, and why, when GitHub cannot be reached', async () => {
    const fake = new FakeGh();
    fake.failWith = 'gh: not logged in';

    const synced = await syncOver(fake).show(origin, 'building');

    expect(synced).toEqual({ state: 'failed', on: ON.toISOString(), detail: 'gh: not logged in' });
  });

  it('should touch nothing when the story has no issue', async () => {
    const fake = new FakeGh();

    const synced = await syncOver(fake).show({ issue: '', epic: '' }, 'building');

    expect(synced.state).toBe('not linked');
    expect(fake.calls).toEqual([]);
  });
});

describe('GithubIssueSync.closeDone', () => {
  it('should close the story and leave the epic open while other sub-issues remain', async () => {
    const fake = new FakeGh();

    const synced = await syncOver(fake).closeDone(origin);

    expect(synced.detail).toBe('issue #38 closed');
    expect(fake.edits()).toContainEqual(['issue', 'close', '38', '-R', 'demo/site', '--reason', 'completed']);
  });

  it('should close the epic too once every sub-issue is done', async () => {
    const fake = new FakeGh();
    fake.epicSummary = { total: 4, completed: 4 };

    const synced = await syncOver(fake).closeDone(origin);

    expect(synced.detail).toBe('issue #38 closed; epic #36 closed, every sub-issue is done');
    expect(fake.edits()).toContainEqual(['issue', 'close', '36', '-R', 'demo/site', '--reason', 'completed']);
  });
});
