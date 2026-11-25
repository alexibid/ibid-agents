import type { ActiveStories, StoryFocus } from '../domain/concurrent-stories.js';
import { holdsItsFiles, latestStoryThreads, type StoryThread } from '../store/story-threads.js';

export class CheckpointActiveStories implements ActiveStories {
  constructor(private readonly stateFile: string) {}

  async besides(storyId: string): Promise<readonly StoryFocus[]> {
    return latestStoryThreads(this.stateFile)
      .filter((thread) => thread.storyId !== storyId && holdsItsFiles(thread))
      .map(focusOf);
  }

  async changedAlongside(storyId: string): Promise<readonly StoryFocus[]> {
    const threads = latestStoryThreads(this.stateFile);
    const own = threads.find((thread) => thread.storyId === storyId);
    const startedOn = own?.startedOn.getTime() ?? Number.POSITIVE_INFINITY;
    return threads
      .filter((thread) => thread.storyId !== storyId)
      .filter((thread) => holdsItsFiles(thread) || thread.updatedOn.getTime() >= startedOn)
      .map(focusOf);
  }
}

function focusOf({ storyId, files }: StoryThread): StoryFocus {
  return { storyId, files };
}
