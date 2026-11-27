import { MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';
import type { ChangeTracker, ChangedFile, Fingerprint } from './checks/workspace-changes.js';
import { NO_OTHER_STORIES } from './domain/concurrent-stories.js';
import type { MandatoryStep, ProjectSheet } from './domain/sheet.js';
import { buildFlowGraph, type FlowGraph } from './flow/graph.js';
import type { FlowJournal } from './journal/flow-journal.js';
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

function flowOver(
  tree: FakeTree,
  mandatorySteps: readonly MandatoryStep[],
  journal?: FlowJournal,
): { flow: StoryFlow; graph: FlowGraph } {
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
  return { flow: new StoryFlow(graph, journal), graph };
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
    await flow.advanceToCommit(storyId);

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
    tree.changed = [COVER];
    await flow.submit(storyId, { summary: 'opened the cover' });
    await flow.advanceToCommit(storyId);
    tree.changed = [COVER, COVER_SPEC, COVER_MOCK];

    const authored = await flow.submit(storyId, { specFiles: [COVER_SPEC] });

    expect(authored.history.at(-1)).toEqual({ step: 'author-tests', passed: true, details: [] });
  });

  it('should keep the test files the test author wrote as part of the story', async () => {
    const tree = new FakeTree();
    const { flow, graph } = flowOver(tree, always('author-tests', 'implement'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.changed = [COVER];
    await flow.submit(storyId, { summary: 'opened the cover' });
    await flow.advanceToCommit(storyId);
    tree.changed = [COVER, COVER_SPEC, COVER_MOCK, STRAY];

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
    await flow.submit(storyId, { summary: 'the cover already opens' });
    await flow.advanceToCommit(storyId);

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

describe('StoryFlow started before the commit phase existed', () => {
  it('should hold a commit step it was already waiting for until the user asks to commit', async () => {
    const tree = new FakeTree();
    const { flow, graph } = flowOver(tree, always('implement', 'validate-tests', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.changed = [COVER];
    await flow.submit(storyId, { summary: 'opened the cover' });
    const config = { configurable: { thread_id: storyId } };
    await graph.updateState(config, { status: 'working' }, 'implement');
    await graph.invoke(null, config);

    const held = await flow.submit(storyId, { criteria: [{ criterion: 'The cover opens', test: 'opens', proven: true }] });

    expect(held.status).toBe('ready-for-commit');
    expect(held.next).toBe('nothing');
    expect(held.history.some(({ step }) => step === 'validate-tests')).toBe(false);
  });
});

describe('StoryFlow attempts visibility and hold journal sync', () => {
  it('should report remaining attempt counts across hold and advance, and record holdForCommit in the journal', async () => {
    const tree = new FakeTree();
    const statuses: string[] = [];
    const journal: FlowJournal = {
      storyStarted: async ({ status }) => {
        statuses.push(status);
        return true;
      },
      stepsJudged: async ({ status }) => {
        statuses.push(status);
        return true;
      },
    };
    const { flow } = flowOver(tree, always('implement', 'author-tests', 'validate-tests', 'review'), journal);
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.changed = [COVER];
    await flow.submit(storyId, { summary: 'opened the cover' });
    tree.changed = [COVER, COVER_SPEC];
    await flow.submit(storyId, { specFiles: [COVER_SPEC] });
    await flow.advanceToCommit(storyId);

    const failedOnce = await flow.submit(storyId, {
      criteria: [{ criterion: 'The cover opens', test: 'missing assertion', proven: false }],
    });
    expect(failedOnce.attempts).toEqual({ 'validate-tests': 1 });

    const held = await flow.holdForCommit(storyId);
    expect(held.status).toBe('ready-for-commit');
    expect(held.attempts).toEqual({ 'validate-tests': 1 });
    expect(held.recorded).toBe(true);
    expect(statuses.at(-1)).toBe('ready-for-commit');

    const resumedCommit = await flow.advanceToCommit(storyId);
    expect(resumedCommit.attempts).toEqual({ 'validate-tests': 1 });
  });
});

describe('StoryFlow attempts across passes and concurrent stray edits', () => {
  it('should clear implement attempts after passing so later repairs start fresh', async () => {
    const tree = new FakeTree();
    const { flow } = flowOver(tree, always('implement', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });

    await flow.submit(storyId, { summary: 'nothing changed yet' });
    await flow.submit(storyId, { summary: 'still nothing changed' });
    tree.changed = [COVER];
    const passedImplement = await flow.submit(storyId, { summary: 'opened the cover' });
    expect(passedImplement.attempts).toEqual({});

    await flow.advanceToCommit(storyId);
    await flow.submit(storyId, { findings: [{ rule: 'W14', file: COVER, description: 'fix name', blocking: true }] });
    tree.changed = [];
    await flow.submit(storyId, { summary: 'reverted by mistake' });
    tree.changed = [COVER, STRAY];
    const fourthTryOverall = await flow.submit(storyId, { summary: 'forgot extraFiles once' });

    expect(fourthTryOverall.status).toBe('working');
    expect(fourthTryOverall.attempts).toEqual({ review: 1, implement: 1, 'implement extra-files': 1 });
  });

  it('should not block as needs-user when the agent declares prior stray files and a new concurrent edit appears', async () => {
    const tree = new FakeTree();
    const { flow } = flowOver(tree, always('implement', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });

    tree.changed = [COVER, 'apps/demo/src/layout.scss'];
    await flow.submit(storyId, { summary: 'opened the cover' });

    tree.changed = [COVER, 'apps/demo/src/layout.scss', 'apps/demo/src/book.scss'];
    const declaredFirst = await flow.submit(storyId, {
      summary: 'declared layout',
      extraFiles: [{ file: 'apps/demo/src/layout.scss', reason: 'user edited' }],
    });

    tree.changed = [COVER, 'apps/demo/src/layout.scss', 'apps/demo/src/book.scss', 'apps/demo/src/footer.scss'];
    const declaredSecond = await flow.submit(storyId, {
      summary: 'declared book',
      extraFiles: [
        { file: 'apps/demo/src/layout.scss', reason: 'user edited' },
        { file: 'apps/demo/src/book.scss', reason: 'quick change' },
      ],
    });

    expect(declaredFirst.status).toBe('working');
    expect(declaredSecond.status).toBe('working');
    expect(declaredSecond.history.at(-1)?.details).toEqual([
      'apps/demo/src/footer.scss was changed but is not in the plan. Declare it in "extraFiles" with the reason, or revert it.',
    ]);
  });

  it('should still stop as needs-user if an undeclared file goes unresolved three times even while new strays appear', async () => {
    const tree = new FakeTree();
    const { flow } = flowOver(tree, always('implement', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });

    tree.changed = [COVER, STRAY];
    await flow.submit(storyId, { summary: 'try 1' });
    tree.changed = [COVER, STRAY, 'apps/demo/src/other.scss'];
    await flow.submit(storyId, { summary: 'try 2' });
    const third = await flow.submit(storyId, { summary: 'try 3' });

    expect(third.status).toBe('needs-user');
  });
});
