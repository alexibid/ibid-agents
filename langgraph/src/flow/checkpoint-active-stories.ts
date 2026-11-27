import type { ActiveStories, StoryFocus } from '../domain/concurrent-stories.js';
import { latestAgentRunFiles, type AgentRunFiles } from '../store/agent-run-files.js';
import { holdsItsFiles, latestStoryThreads, type StoryThread } from '../store/story-threads.js';

export interface ActiveStoriesOptions {
  readonly agentRunsFile?: string;
  readonly workspaceRoot?: string;
}

export class CheckpointActiveStories implements ActiveStories {
  constructor(
    private readonly stateFile: string,
    private readonly options: ActiveStoriesOptions = {},
  ) {}

  async besides(storyId: string): Promise<readonly StoryFocus[]> {
    return latestStoryThreads(this.stateFile)
      .filter((thread) => thread.storyId !== storyId && holdsItsFiles(thread))
      .map(focusOf);
  }

  async changedAlongside(storyId: string): Promise<readonly StoryFocus[]> {
    const threads = latestStoryThreads(this.stateFile);
    const own = threads.find((thread) => thread.storyId === storyId);
    const startedOn = own?.startedOn.getTime() ?? Number.POSITIVE_INFINITY;
    const stories = threads
      .filter((thread) => thread.storyId !== storyId)
      .filter((thread) => holdsItsFiles(thread) || thread.updatedOn.getTime() >= startedOn)
      .map(focusOf);
    return [...stories, ...this.agentRunsSince(startedOn)];
  }

  private agentRunsSince(startedOn: number): StoryFocus[] {
    const { agentRunsFile, workspaceRoot } = this.options;
    if (agentRunsFile === undefined || workspaceRoot === undefined || workspaceRoot === '') {
      return [];
    }
    return latestAgentRunFiles(agentRunsFile, workspaceRoot)
      .filter((run) => run.updatedOn.getTime() >= startedOn)
      .map(agentRunFocusOf);
  }
}

function focusOf({ storyId, files }: StoryThread): StoryFocus {
  return { storyId, files };
}

function agentRunFocusOf({ runId, files }: AgentRunFiles): StoryFocus {
  return { storyId: runId, files };
}
