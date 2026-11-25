import { MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';
import type { ChangeTracker, ChangedFile } from './checks/workspace-changes.js';
import { NO_OTHER_STORIES, type ActiveStories } from './domain/concurrent-stories.js';
import type { ProjectSheet } from './domain/sheet.js';
import { buildFlowGraph } from './flow/graph.js';
import type { SheetSource } from './sheets/sheet-reader.js';
import { StoryFlow } from './story-flow.js';

const sheet: ProjectSheet = {
  project: 'demo',
  path: 'apps/demo',
  commitScope: 'demo',
  sheetFile: 'demo.md',
  reuses: [],
  specialist: 'agents/specialist.md',
  agents: [],
  triggers: [],
  mandatorySteps: [
    { step: 'author-tests', when: 'always' },
    { step: 'implement', when: 'always' },
    { step: 'review', when: 'always' },
    { step: 'browser-qa', when: 'ui' },
    { step: 'final-verification', when: 'always' },
  ],
  commands: {},
};

const sheets: SheetSource = { read: async () => sheet };
const noChanges: ChangeTracker = { fingerprint: async () => ({}), changedSince: async () => [] };

const story = { project: 'demo', title: 'Show the total', criteria: ['The total is shown'] };

function storyFlow(): StoryFlow {
  const graph = buildFlowGraph(
    { workspaceRoot: '/workspace', sheets, contractsDirectory: '/contracts', changesOf: () => noChanges, activeStories: NO_OTHER_STORIES },
    new MemorySaver(),
  );
  return new StoryFlow(graph);
}

describe('StoryFlow remaining steps', () => {
  it('should list the plan and every step a plan always runs after start_story', async () => {
    const started = await storyFlow().startStory(story);

    expect(started.remainingSteps).toEqual(['plan', 'implement', 'author-tests', 'review', 'final-verification']);
  });

  it('should list the planned steps, conditional ones included, after an accepted plan', async () => {
    const flow = storyFlow();
    const { storyId } = await flow.startStory(story);

    const planned = await flow.submit(storyId, { files: ['apps/demo/src/a.html'], conditions: ['ui'] });

    expect(planned.status).toBe('working');
    expect(planned.remainingSteps).toEqual(['implement', 'author-tests', 'browser-qa', 'review', 'final-verification']);
  });

  it('should keep listing the plan first after a rejected plan', async () => {
    const flow = storyFlow();
    const { storyId } = await flow.startStory(story);

    const rejected = await flow.submit(storyId, { files: [], conditions: [] });

    expect(rejected.remainingSteps[0]).toBe('plan');
  });
});

describe('StoryFlow with another story in progress', () => {
  const twoStepSheet: ProjectSheet = {
    ...sheet,
    mandatorySteps: [
      { step: 'implement', when: 'always' },
      { step: 'review', when: 'always' },
    ],
  };
  const encodingFocus = [{ storyId: 'demo-encoding', files: ['apps/demo/src/content.utils.ts'] }];
  const encodingStory: ActiveStories = { besides: async () => encodingFocus, changedAlongside: async () => encodingFocus };
  const changed = (file: string): ChangedFile => ({ repository: '.', file, alreadyDirty: false });
  const bothStoriesChanged: ChangeTracker = {
    fingerprint: async () => ({}),
    changedSince: async () => [changed('apps/demo/src/cover.ts'), changed('apps/demo/src/content.utils.ts')],
  };

  function concurrentFlow(): StoryFlow {
    const graph = buildFlowGraph(
      {
        workspaceRoot: '/workspace',
        sheets: { read: async () => twoStepSheet },
        contractsDirectory: '/contracts',
        changesOf: () => bothStoriesChanged,
        activeStories: encodingStory,
      },
      new MemorySaver(),
    );
    return new StoryFlow(graph);
  }

  it('should reject a plan that takes a file the other story owns', async () => {
    const flow = concurrentFlow();
    const { storyId } = await flow.startStory(story);

    const rejected = await flow.submit(storyId, { files: ['apps/demo/src/content.utils.ts'], conditions: [] });

    expect(rejected.status).toBe('planning');
    expect(rejected.history.at(-1)?.details).toEqual([
      'apps/demo/src/content.utils.ts already belongs to the story demo-encoding, which is in progress. Plan a different focus.',
    ]);
  });

  it('should not blame the implementation for what the other story changed', async () => {
    const flow = concurrentFlow();
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: ['apps/demo/src/cover.ts'], conditions: [] });

    const implemented = await flow.submit(storyId, { summary: 'moved the cover' });

    expect(implemented.history.at(-1)).toEqual({ step: 'implement', passed: true, details: [] });
    expect(implemented.remainingSteps).toEqual(['review']);
  });
});


describe('StoryFlow abandoning a story', () => {
  it('should stop handing out steps and stop counting the story as in progress', async () => {
    const flow = storyFlow();
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: ['apps/demo/src/a.ts'], conditions: [] });

    const abandoned = await flow.abandon(storyId);
    const resubmitted = await flow.submit(storyId, { specFiles: ['apps/demo/src/a.spec.ts'] });

    expect(abandoned).toMatchObject({ status: 'abandoned', next: 'nothing', remainingSteps: [] });
    expect(resubmitted.status).toBe('abandoned');
    expect(resubmitted.history).toHaveLength(abandoned.history.length);
  });

  it('should abandon a story that is still waiting for its plan', async () => {
    const flow = storyFlow();
    const { storyId } = await flow.startStory(story);

    expect((await flow.abandon(storyId)).status).toBe('abandoned');
  });
});
