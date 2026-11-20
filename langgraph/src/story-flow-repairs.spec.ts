import { MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';
import type { ChangeTracker, ChangedFile, Fingerprint } from './checks/workspace-changes.js';
import { NO_OTHER_STORIES } from './domain/concurrent-stories.js';
import type { MandatoryStep, ProjectSheet } from './domain/sheet.js';
import { buildFlowGraph, type FlowGraph } from './flow/graph.js';
import { StoryFlow } from './story-flow.js';

const COVER = 'apps/demo/src/cover.ts';
const COVER_SPEC = 'apps/demo/src/cover.spec.ts';
const COVER_MOCK = 'apps/demo/src/cover.mock.ts';
const STRAY = 'apps/demo/src/stray.ts';

const story = { project: 'demo', title: 'Open the cover', criteria: ['The cover opens'] };

const sheetWith = (mandatorySteps: readonly MandatoryStep[]): ProjectSheet => ({
  project: 'demo',
  path: 'apps/demo',
  commitScope: 'demo',
  sheetFile: 'demo.md',
  reuses: [],
  specialist: 'agents/specialist.md',
  agents: [],
  triggers: [],
  mandatorySteps,
  commands: {},
});

class FakeTree implements ChangeTracker {
  changed: readonly string[] = [];

  constructor(private readonly dirtyAtStart: Fingerprint = {}) {}

  async fingerprint(): Promise<Fingerprint> {
    return this.dirtyAtStart;
  }

  async changedSince(): Promise<ChangedFile[]> {
    return this.changed.map((file) => ({ repository: '.', file, alreadyDirty: false }));
  }
}

function flowOver(tree: FakeTree, mandatorySteps: readonly MandatoryStep[]): { flow: StoryFlow; graph: FlowGraph } {
  const graph = buildFlowGraph(
    {
      workspaceRoot: '/workspace',
      sheets: { read: async () => sheetWith(mandatorySteps) },
      contractsDirectory: '/contracts',
      changesOf: () => tree,
      activeStories: NO_OTHER_STORIES,
    },
    new MemorySaver(),
  );
  return { flow: new StoryFlow(graph), graph };
}

const always = (...steps: MandatoryStep['step'][]): MandatoryStep[] => steps.map((step) => ({ step, when: 'always' }));

describe('StoryFlow with a hand-back in the wrong shape', () => {
  it('should ask again for the same step instead of sending the work back to implement', async () => {
    const tree = new FakeTree();
    const { flow } = flowOver(tree, [...always('implement', 'review'), { step: 'browser-qa', when: 'ui' }]);
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: ['apps/demo/src/cover.html'], conditions: ['ui'] });
    tree.changed = ['apps/demo/src/cover.html'];
    await flow.submit(storyId, { summary: 'opened the cover' });

    const resent = await flow.submit(storyId, { verdict: 'pass', findings: [], screenshots: [] });

    expect(resent.remainingSteps[0]).toBe('browser-qa');
    expect(resent.history.at(-1)?.details[0]).toContain('nothing was judged');
  });

  it('should not spend an attempt of the work on a hand-back in the wrong shape', async () => {
    const tree = new FakeTree();
    const { flow } = flowOver(tree, always('implement', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.changed = [COVER, STRAY];
    await flow.submit(storyId, { summary: 'opened the cover' });
    await flow.submit(storyId, { summary: 'opened the cover' });

    const afterWrongShape = await flow.submit(storyId, { description: 'opened the cover' });
    const afterThirdFailure = await flow.submit(storyId, { summary: 'opened the cover' });

    expect(afterWrongShape.status).toBe('working');
    expect(afterThirdFailure.status).toBe('needs-user');
  });
});

describe('StoryFlow with test files', () => {
  it('should not blame the implementation for the mock file the test author wrote', async () => {
    const tree = new FakeTree();
    const { flow } = flowOver(tree, always('author-tests', 'implement', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.changed = [COVER_SPEC, COVER_MOCK];
    await flow.submit(storyId, { specFiles: [COVER_SPEC] });
    tree.changed = [COVER_SPEC, COVER_MOCK, COVER];

    const implemented = await flow.submit(storyId, { summary: 'opened the cover' });

    expect(implemented.history.at(-1)).toEqual({ step: 'implement', passed: true, details: [] });
  });

  it('should keep the test files the test author wrote as part of the story', async () => {
    const tree = new FakeTree();
    const { flow, graph } = flowOver(tree, always('author-tests', 'implement'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.changed = [COVER_SPEC, COVER_MOCK, STRAY];

    await flow.submit(storyId, { specFiles: [COVER_SPEC] });

    const snapshot = await graph.getState({ configurable: { thread_id: storyId } });
    expect(snapshot.values['testFiles']).toEqual([COVER_SPEC, COVER_MOCK]);
  });
});

describe('StoryFlow restarted over work already in the tree', () => {
  const carriedOver = { [COVER]: 'hash-of-cover', [COVER_SPEC]: 'hash-of-spec' };

  it('should accept spec files an earlier attempt already wrote', async () => {
    const { flow } = flowOver(new FakeTree(carriedOver), always('author-tests', 'implement'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });

    const authored = await flow.submit(storyId, { specFiles: [COVER_SPEC] });

    expect(authored.history.at(-1)?.passed).toBe(true);
  });

  it('should accept an implementation an earlier attempt already made', async () => {
    const { flow } = flowOver(new FakeTree(carriedOver), always('implement', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });

    const implemented = await flow.submit(storyId, { summary: 'the cover already opens' });

    expect(implemented.history.at(-1)).toEqual({
      step: 'implement',
      passed: true,
      details: [`${COVER} is unchanged in this story; it already carried uncommitted work when the story began.`],
    });
  });

  it('should still reject an implementation that changed nothing in a clean tree', async () => {
    const { flow } = flowOver(new FakeTree(), always('implement', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });

    const implemented = await flow.submit(storyId, { summary: 'nothing' });

    expect(implemented.history.at(-1)).toEqual({ step: 'implement', passed: false, details: ['No file was changed.'] });
  });
});
