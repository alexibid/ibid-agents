import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';
import type { ChangeTracker, ChangedFile, Fingerprint } from './checks/workspace-changes.js';
import { NO_OTHER_STORIES } from './domain/concurrent-stories.js';
import type { MandatoryStep, ProjectSheet } from './domain/sheet.js';
import { buildFlowGraph } from './flow/graph.js';
import { ONLY_TESTS_CHANGED, SCREEN_UNCHANGED, TESTS_KEPT } from './flow/repeat-skips.js';
import { StoryFlow, StoryNotWaitingError } from './story-flow.js';

const COVER = 'apps/demo/src/cover.ts';
const COVER_VIEW = 'apps/demo/src/cover.html';
const COVER_SPEC = 'apps/demo/src/cover.spec.ts';
const STRAY = 'apps/demo/src/stray.ts';
const story = { project: 'demo', title: 'Open the cover', criteria: ['The cover opens'] };
const origin = { issue: 'https://github.com/demo/site/issues/38', epic: 'https://github.com/demo/site/issues/36' };

class EditedTree implements ChangeTracker {
  private readonly edits: string[] = [];

  edit(...files: string[]): void {
    this.edits.push(...files);
  }

  async fingerprint(): Promise<Fingerprint> {
    return { edits: String(this.edits.length) };
  }

  async changedSince(since: Fingerprint): Promise<ChangedFile[]> {
    const files = [...new Set(this.edits.slice(Number(since['edits'] ?? 0)))];
    return files.map((file) => ({ repository: '.', file, alreadyDirty: false }));
  }
}

function flowOver(
  tree: EditedTree,
  mandatorySteps: readonly MandatoryStep[],
  workspaceRoot = '/workspace',
  commands: ProjectSheet['commands'] = {},
): StoryFlow {
  const sheet: ProjectSheet = {
    project: 'demo',
    path: 'apps/demo',
    commitScope: 'demo',
    sheetFile: 'demo.md',
    reuses: [],
    specialist: 'agents/specialist.md',
    agents: [],
    triggers: [],
    mandatorySteps,
    commands,
  };
  const graph = buildFlowGraph(
    { workspaceRoot, sheets: { read: async () => sheet }, contractsDirectory: '/contracts', changesOf: () => tree, activeStories: NO_OTHER_STORIES },
    new MemorySaver(),
  );
  return new StoryFlow(graph);
}

const always = (...steps: MandatoryStep['step'][]): MandatoryStep[] => steps.map((step) => ({ step, when: 'always' }));
const stepOf = (report: Awaited<ReturnType<StoryFlow['report']>>): string => (report.next === 'nothing' ? 'nothing' : report.next.step);

describe('StoryFlow phases', () => {
  it('should hand the code to the test author right after the developer', async () => {
    const tree = new EditedTree();
    const flow = flowOver(tree, always('implement', 'author-tests', 'validate-tests', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.edit(COVER);

    const built = await flow.submit(storyId, { summary: 'opened the cover' });

    expect(stepOf(built)).toBe('author-tests');
  });

  it('should wait for the user once the code and its tests are written', async () => {
    const tree = new EditedTree();
    const flow = flowOver(tree, always('implement', 'author-tests', 'validate-tests', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.edit(COVER);
    await flow.submit(storyId, { summary: 'opened the cover' });
    tree.edit(COVER_SPEC);

    const written = await flow.submit(storyId, { specFiles: [COVER_SPEC] });

    expect(written.status).toBe('ready-for-commit');
    expect(written.next).toBe('nothing');
    expect(written.remainingSteps).toEqual(['validate-tests', 'review']);
  });

  it('should validate the tests only when the user asks to move on to the commit', async () => {
    const tree = new EditedTree();
    const flow = flowOver(tree, always('implement', 'author-tests', 'validate-tests', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.edit(COVER);
    await flow.submit(storyId, { summary: 'opened the cover' });
    tree.edit(COVER_SPEC);
    await flow.submit(storyId, { specFiles: [COVER_SPEC] });

    const advanced = await flow.advanceToCommit(storyId);

    expect(advanced.status).toBe('working');
    expect(stepOf(advanced)).toBe('validate-tests');
  });

  it('should go straight on to the commit steps when the user asked for it while building', async () => {
    const tree = new EditedTree();
    const flow = flowOver(tree, always('implement', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    await flow.advanceToCommit(storyId);
    tree.edit(COVER);

    const built = await flow.submit(storyId, { summary: 'opened the cover' });

    expect(built.status).toBe('working');
    expect(stepOf(built)).toBe('review');
  });
});

describe('StoryFlow resume', () => {
  async function stuckStory(): Promise<{ flow: StoryFlow; storyId: string; tree: EditedTree }> {
    const tree = new EditedTree();
    const flow = flowOver(tree, always('implement', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.edit(COVER, STRAY);
    for (const attempt of [1, 2, 3]) {
      await flow.submit(storyId, { summary: `try ${attempt}` });
    }
    return { flow, storyId, tree };
  }

  it('should take up a story that waits for the user at the step that failed, with fresh attempts', async () => {
    const { flow, storyId } = await stuckStory();

    const resumed = await flow.resume(storyId);

    expect(resumed.status).toBe('working');
    expect(stepOf(resumed)).toBe('implement');
  });

  it('should refuse to resume a story that is not waiting for the user', async () => {
    const tree = new EditedTree();
    const flow = flowOver(tree, always('implement', 'review'));
    const { storyId } = await flow.startStory(story);

    await expect(flow.resume(storyId)).rejects.toThrow(StoryNotWaitingError);
  });
});

describe('StoryFlow screen checks after a repair', () => {
  const screenSteps: MandatoryStep[] = [...always('implement', 'author-tests', 'review'), { step: 'browser-qa', when: 'ui' }];

  async function reviewedOnce(tree: EditedTree): Promise<{ flow: StoryFlow; storyId: string }> {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'screen-'));
    await writeFile(join(workspaceRoot, 'cover.png'), '');
    const flow = flowOver(tree, screenSteps, workspaceRoot);
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER, COVER_VIEW], conditions: ['ui'] });
    tree.edit(COVER, COVER_VIEW);
    await flow.submit(storyId, { summary: 'opened the cover' });
    tree.edit(COVER_SPEC);
    await flow.submit(storyId, { specFiles: [COVER_SPEC] });
    await flow.advanceToCommit(storyId);
    await flow.submit(storyId, { verdict: 'pass', findings: [], screenshots: ['cover.png'] });
    await flow.submit(storyId, { findings: [{ rule: 'W14', file: COVER, description: 'name hides intent', blocking: true }] });
    return { flow, storyId };
  }

  it('should not open the browser again when the repair changed nothing on screen', async () => {
    const tree = new EditedTree();
    const { flow, storyId } = await reviewedOnce(tree);
    tree.edit(COVER);

    await flow.submit(storyId, { summary: 'kept the cover, fixed the test' });
    const repaired = await flow.advanceToCommit(storyId);

    const browser = repaired.history.filter(({ step }) => step === 'browser-qa').at(-1);
    expect(browser).toEqual({ step: 'browser-qa', passed: true, details: [SCREEN_UNCHANGED] });
  });

  it('should open the browser again when the repair changed the view', async () => {
    const tree = new EditedTree();
    const { flow, storyId } = await reviewedOnce(tree);
    tree.edit(COVER_VIEW);

    await flow.submit(storyId, { summary: 'moved the cover' });
    const repaired = await flow.advanceToCommit(storyId);

    expect(stepOf(repaired)).toBe('browser-qa');
  });
});

describe('StoryFlow origin', () => {
  it('should report the issue and the epic the story comes from', async () => {
    const flow = flowOver(new EditedTree(), always('implement'));

    const started = await flow.startStory(story, origin);

    expect(started.origin).toEqual(origin);
  });

  it('should link an issue to a story that started without one', async () => {
    const flow = flowOver(new EditedTree(), always('implement'));
    const { storyId } = await flow.startStory(story);

    const linked = await flow.linkOrigin(storyId, origin);

    expect(linked.origin).toEqual(origin);
  });
});

describe('StoryFlow build after a repair', () => {
  async function failedReview(tree: EditedTree): Promise<{ flow: StoryFlow; storyId: string }> {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'build-'));
    const flow = flowOver(tree, always('implement', 'build', 'author-tests', 'review'), workspaceRoot, { build: 'true' });
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.edit(COVER);
    await flow.submit(storyId, { summary: 'opened the cover' });
    tree.edit(COVER_SPEC);
    await flow.submit(storyId, { specFiles: [COVER_SPEC] });
    await flow.advanceToCommit(storyId);
    await flow.submit(storyId, { findings: [{ rule: 'T11', file: COVER_SPEC, description: 'shape only', blocking: true }] });
    return { flow, storyId };
  }

  it('should not build again when the repair changed only tests', async () => {
    const tree = new EditedTree();
    const { flow, storyId } = await failedReview(tree);
    tree.edit(COVER_SPEC);

    const repaired = await flow.submit(storyId, { summary: 'fixed the test only' });

    expect(repaired.history.filter(({ step }) => step === 'build').at(-1)?.details).toEqual([ONLY_TESTS_CHANGED]);
  });

  it('should build again when the repair changed the code', async () => {
    const tree = new EditedTree();
    const { flow, storyId } = await failedReview(tree);
    tree.edit(COVER);

    const repaired = await flow.submit(storyId, { summary: 'changed the cover' });

    expect(repaired.history.filter(({ step }) => step === 'build').at(-1)?.details).toEqual([]);
  });
});

describe('StoryFlow test author on a repair', () => {
  const unproven = { criteria: [{ criterion: 'The cover opens', test: 'no test opens the cover', proven: false }] };
  const blocking = { findings: [{ rule: 'W14', file: COVER, description: 'name hides intent', blocking: true }] };

  async function atTheCommit(tree: EditedTree): Promise<{ flow: StoryFlow; storyId: string }> {
    const flow = flowOver(tree, always('implement', 'author-tests', 'validate-tests', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.edit(COVER);
    await flow.submit(storyId, { summary: 'opened the cover' });
    tree.edit(COVER_SPEC);
    await flow.submit(storyId, { specFiles: [COVER_SPEC] });
    await flow.advanceToCommit(storyId);
    return { flow, storyId };
  }

  it('should keep the written tests when the developer repairs a review finding', async () => {
    const tree = new EditedTree();
    const { flow, storyId } = await atTheCommit(tree);
    await flow.submit(storyId, { criteria: [{ criterion: 'The cover opens', test: 'opens the cover', proven: true }] });
    await flow.submit(storyId, blocking);
    tree.edit(COVER);

    const repaired = await flow.submit(storyId, { summary: 'renamed for intent' });
    const advanced = await flow.advanceToCommit(storyId);

    expect(repaired.history.at(-1)).toEqual({ step: 'author-tests', passed: true, details: [TESTS_KEPT] });
    expect(stepOf(advanced)).toBe('validate-tests');
  });

  it('should call the test author again when the validator finds a gap', async () => {
    const { flow, storyId } = await atTheCommit(new EditedTree());

    const gap = await flow.submit(storyId, unproven);

    expect(stepOf(gap)).toBe('author-tests');
  });
});

describe('StoryFlow questions instead of guesses', () => {
  const question = { summary: 'not started', questions: ['Should the cover keep its shadow while it turns?'] };

  it('should stop and wait for the user when the developer asks instead of guessing', async () => {
    const flow = flowOver(new EditedTree(), always('implement', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });

    const asked = await flow.submit(storyId, question);

    expect(asked.status).toBe('needs-user');
    expect(asked.history.at(-1)?.details).toContain('Should the cover keep its shadow while it turns?');
  });

  it('should give the developer the user decision when the story is resumed', async () => {
    const flow = flowOver(new EditedTree(), always('implement', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    await flow.submit(storyId, question);

    const resumed = await flow.resume(storyId, 'Keep the shadow.');

    expect(stepOf(resumed)).toBe('implement');
    expect(resumed.next === 'nothing' ? '' : resumed.next.brief).toContain('The user decided: Keep the shadow.');
  });

  it('should let the specialist ask before planning anything', async () => {
    const flow = flowOver(new EditedTree(), always('implement', 'review'));
    const { storyId } = await flow.startStory(story);

    const asked = await flow.submit(storyId, { questions: ['Does the cover open on mobile too?'] });
    const resumed = await flow.resume(storyId, 'Desktop only.');

    expect(asked.status).toBe('needs-user');
    expect(resumed.next === 'nothing' ? '' : resumed.next.step).toBe('plan');
    expect(resumed.next === 'nothing' ? '' : resumed.next.brief).toContain('Desktop only.');
  });
});

describe('StoryFlow commit request after a code repair', () => {
  it('should build again and wait for the user when a commit step sends the code back', async () => {
    const tree = new EditedTree();
    const flow = flowOver(tree, always('implement', 'author-tests', 'validate-tests', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.edit(COVER);
    await flow.submit(storyId, { summary: 'opened the cover' });
    tree.edit(COVER_SPEC);
    await flow.submit(storyId, { specFiles: [COVER_SPEC] });
    await flow.advanceToCommit(storyId);
    await flow.submit(storyId, { criteria: [{ criterion: 'The cover opens', test: 'opens the cover', proven: true }] });
    await flow.submit(storyId, { findings: [{ rule: 'W63', file: COVER, description: 'duplicated', blocking: true }] });
    tree.edit(COVER);

    const repaired = await flow.submit(storyId, { summary: 'removed the duplicate' });

    expect(repaired.status).toBe('ready-for-commit');
    expect(repaired.phase).toBe('building');
    expect(repaired.next).toBe('nothing');
  });
});

describe('StoryFlow hold', () => {
  it('should stop the commit steps when the user changes their mind, until they ask again', async () => {
    const tree = new EditedTree();
    const flow = flowOver(tree, always('implement', 'author-tests', 'validate-tests', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.edit(COVER);
    await flow.submit(storyId, { summary: 'opened the cover' });
    tree.edit(COVER_SPEC);
    await flow.submit(storyId, { specFiles: [COVER_SPEC] });
    await flow.advanceToCommit(storyId);

    const held = await flow.holdForCommit(storyId);
    const again = await flow.advanceToCommit(storyId);

    expect(held.status).toBe('ready-for-commit');
    expect(held.next).toBe('nothing');
    expect(stepOf(again)).toBe('validate-tests');
  });
});
