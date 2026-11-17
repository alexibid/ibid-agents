import { describe, expect, it } from 'vitest';
import type { FlowStep } from '../agent-runs/definition.js';
import { DatabaseUnavailableError } from '../store/database-settings.js';
import type { BacklogArchive, StoredEpic } from './backlog-archive.js';
import type { BacklogDraft, IssueLink } from './backlog.js';
import { BacklogKeeper } from './backlog-keeper.js';

class ArchiveSpy implements BacklogArchive {
  readonly drafts: { runId: string; draft: BacklogDraft }[] = [];
  readonly published: { epicId: string; links: readonly IssueLink[] }[] = [];

  constructor(private readonly fault: Error = new Error('none')) {}

  async keepDraft(runId: string, draft: BacklogDraft): Promise<void> {
    this.#failWhenAsked();
    this.drafts.push({ runId, draft });
  }

  async recordPublished(epicId: string, links: readonly IssueLink[]): Promise<void> {
    this.published.push({ epicId, links });
  }

  async epics(): Promise<StoredEpic[]> {
    return [];
  }

  #failWhenAsked(): void {
    if (this.fault.message !== 'none') {
      throw this.fault;
    }
  }
}

const step = (fields: FlowStep['fields']): FlowStep => ({
  id: 'draft-issues',
  name: 'Escrever',
  doneBy: 'project-manager',
  task: 'Write.',
  fields,
  calls: [],
});
const DRAFT = {
  id: 'drive-e-creditos',
  project: 'papikapi',
  items: [{ key: 'Épico', kind: 'epic', title: 'Drive', body: 'Texto', size: 'L', repository: 'alexibid/papikapi', parent: '', issue: '' }],
};
const LINKS = [{ key: 'Épico', url: 'https://github.com/alexibid/papikapi/issues/1' }];

describe('BacklogKeeper', () => {
  it('should keep the draft of a backlog step under its run', async () => {
    const archive = new ArchiveSpy();

    const kept = await new BacklogKeeper(archive).keep({
      runId: 'pm~1',
      step: step({ backlog: 'backlog' }),
      handedBack: { backlog: DRAFT },
      earlier: {},
    });

    expect(kept).toBe(true);
    expect(archive.drafts.map(({ runId, draft }) => [runId, draft.id])).toEqual([['pm~1', 'drive-e-creditos']]);
  });

  it('should record the links of the published issues against the earlier draft', async () => {
    const archive = new ArchiveSpy();

    await new BacklogKeeper(archive).keep({
      runId: 'pm~1',
      step: step({ issueLinks: 'published-issues' }),
      handedBack: { issueLinks: LINKS },
      earlier: { 'draft-issues': { backlog: DRAFT } },
    });

    expect(archive.published).toEqual([{ epicId: 'drive-e-creditos', links: LINKS }]);
  });

  it('should keep nothing for a step without backlog fields', async () => {
    const archive = new ArchiveSpy();

    expect(
      await new BacklogKeeper(archive).keep({ runId: 'pm~1', step: step({ size: 'text' }), handedBack: { size: 'L' }, earlier: {} }),
    ).toBe(true);
    expect(archive.drafts).toEqual([]);
  });

  it('should say it kept nothing when the database is down', async () => {
    const keeper = new BacklogKeeper(new ArchiveSpy(new DatabaseUnavailableError()));

    expect(await keeper.keep({ runId: 'pm~1', step: step({ backlog: 'backlog' }), handedBack: { backlog: DRAFT }, earlier: {} })).toBe(
      false,
    );
  });
});
