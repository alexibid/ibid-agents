export interface StoryFocus {
  readonly storyId: string;
  readonly files: readonly string[];
}

export interface ActiveStories {
  besides(storyId: string): Promise<readonly StoryFocus[]>;
  changedAlongside(storyId: string): Promise<readonly StoryFocus[]>;
}

export const NO_OTHER_STORIES: ActiveStories = { besides: async () => [], changedAlongside: async () => [] };

export function clashesWith(files: readonly string[], others: readonly StoryFocus[]): string[] {
  return others.flatMap(({ storyId, files: theirs }) =>
    files
      .filter((file) => theirs.includes(file))
      .map((file) => `${file} already belongs to the story ${storyId}, which is in progress. Plan a different focus.`),
  );
}

export function ownChanges<Change extends { readonly file: string }>(
  changes: readonly Change[],
  ownFiles: readonly string[],
  others: readonly StoryFocus[],
): Change[] {
  const theirs = new Set(others.flatMap(({ files }) => files));
  return changes.filter(({ file }) => ownFiles.includes(file) || !theirs.has(file));
}
