export type ItemKind = 'epic' | 'story' | 'task';
export type ItemState = 'draft' | 'published';

export interface BacklogItem {
  readonly key: string;
  readonly kind: ItemKind;
  readonly title: string;
  readonly body: string;
  readonly size: 'S' | 'M' | 'L';
  readonly repository: string;
  readonly parent: string;
  readonly issueType: string;
  readonly labels: readonly string[];
  readonly issueUrl: string;
  readonly state: ItemState;
}

export interface Epic {
  readonly id: string;
  readonly project: string;
  readonly title: string;
  readonly runId: string;
  readonly updatedOn: string;
  readonly items: readonly BacklogItem[];
}

export interface StoryOutline {
  readonly story: BacklogItem;
  readonly tasks: readonly BacklogItem[];
}

export interface EpicOutline {
  readonly head: BacklogItem;
  readonly epicTasks: readonly BacklogItem[];
  readonly stories: readonly StoryOutline[];
  readonly published: number;
  readonly total: number;
}

export function outlineOf(epic: Epic): EpicOutline {
  const head = epic.items.find((item) => item.kind === 'epic') ?? epic.items[0];
  if (head === undefined) {
    throw new Error(`The epic "${epic.id}" has no issues.`);
  }
  const childrenOf = (key: string) => epic.items.filter((item) => item.parent === key);
  return {
    head,
    epicTasks: childrenOf(head.key).filter((item) => item.kind === 'task'),
    stories: childrenOf(head.key)
      .filter((item) => item.kind === 'story')
      .map((story) => ({ story, tasks: childrenOf(story.key) })),
    published: epic.items.filter((item) => item.state === 'published').length,
    total: epic.items.length,
  };
}

export function issueNameOf(item: BacklogItem): string {
  const published = item.issueUrl.match(/\/([^/]+)\/issues\/(\d+)$/);
  if (published !== null) {
    return `${published[1]}#${published[2]}`;
  }
  return item.repository.split('/').at(-1) ?? item.repository;
}

function matchesText(item: BacklogItem, needle: string): boolean {
  return item.title.toLowerCase().includes(needle) || item.body.toLowerCase().includes(needle);
}

export function filterOutline(outline: EpicOutline, query: string): EpicOutline | null {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return outline;
  }
  if (matchesText(outline.head, needle)) {
    return outline;
  }
  const stories = outline.stories.filter((branch) => matchesText(branch.story, needle));
  if (stories.length === 0) {
    return null;
  }
  return { ...outline, epicTasks: [], stories };
}
