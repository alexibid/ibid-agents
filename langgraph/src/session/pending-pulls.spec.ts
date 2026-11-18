import { describe, expect, it } from 'vitest';
import { pendingPullNotice, pendingPulls, type RepositoryReader } from './pending-pulls.js';

class FakeRepositories implements RepositoryReader {
  constructor(
    private readonly submodules: Readonly<Record<string, readonly string[]>>,
    private readonly behind: Readonly<Record<string, number>>,
  ) {}

  async submodulesOf(root: string): Promise<readonly string[]> {
    return this.submodules[root] ?? [];
  }

  async commitsBehind(directory: string): Promise<number> {
    return this.behind[directory] ?? 0;
  }
}

describe('pendingPulls', () => {
  it('should list every root and submodule that is behind its remote', async () => {
    const reader = new FakeRepositories(
      { '/ws': ['/ws/apps/papikapi', '/ws/libs/utils'] },
      { '/ws': 2, '/ws/apps/papikapi': 1, '/agents': 3 },
    );

    expect(await pendingPulls(['/ws', '/agents'], reader)).toEqual([
      { directory: '/ws', commitsBehind: 2 },
      { directory: '/ws/apps/papikapi', commitsBehind: 1 },
      { directory: '/agents', commitsBehind: 3 },
    ]);
  });

  it('should list nothing when every repository is up to date', async () => {
    expect(await pendingPulls(['/ws'], new FakeRepositories({ '/ws': ['/ws/libs/utils'] }, {}))).toEqual([]);
  });
});

describe('pendingPullNotice', () => {
  it('should ask for the pull of each repository behind its remote', () => {
    const notice = pendingPullNotice([{ directory: '/ws/apps/papikapi', commitsBehind: 4 }]);

    expect(notice).toContain('`/ws/apps/papikapi`: 4 commit(s) behind');
    expect(notice).toContain('git -C /ws/apps/papikapi pull --ff-only');
    expect(notice).toContain('ask them to pull');
  });

  it('should say nothing when nothing is behind', () => {
    expect(pendingPullNotice([])).toBe('');
  });
});
