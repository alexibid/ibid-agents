import type { IssueStateReader } from './issue-states.js';
import type { IssueSync } from './issue-sync.js';
import { addressOf } from './issue-sync.js';

export interface FinishedStory {
  readonly storyId: string;
  readonly issue: string;
  readonly epic: string;
  readonly files: readonly string[];
}

export interface CommitCloserParts {
  readonly finishedStories: () => readonly FinishedStory[];
  readonly uncommittedFiles: () => Promise<ReadonlySet<string>>;
  readonly issueStates: IssueStateReader;
  readonly issues: IssueSync;
}

export class CommitCloser {
  constructor(private readonly parts: CommitCloserParts) {}

  async closeCommitted(): Promise<string[]> {
    const linked = this.parts.finishedStories().filter(({ issue, files }) => issue !== '' && files.length > 0);
    if (linked.length === 0) {
      return [];
    }
    const states = await this.parts.issueStates.statesOf(linked.flatMap(({ issue }) => repositoryOf(issue)));
    const uncommitted = await this.parts.uncommittedFiles();
    const committed = linked.filter(
      ({ issue, files }) => states.get(issue)?.state === 'open' && files.every((file) => !uncommitted.has(file)),
    );
    for (const story of committed) {
      await this.parts.issues.closeDone({ issue: story.issue, epic: story.epic });
    }
    return committed.map(({ storyId }) => storyId);
  }
}

function repositoryOf(issue: string): string[] {
  const address = addressOf(issue);
  return address === undefined ? [] : [address.repository];
}
