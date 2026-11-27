import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';
import type { ChangeTracker, ChangedFile } from './checks/workspace-changes.js';
import { NO_OTHER_STORIES } from './domain/concurrent-stories.js';
import type { ProjectAgent } from './domain/project-team.js';
import type { MandatoryStep, ProjectSheet } from './domain/sheet.js';
import { scannableFiles } from './flow/final-verification.js';
import { buildFlowGraph } from './flow/graph.js';
import type { Instruction } from './flow/instructions.js';
import { StoryFlow } from './story-flow.js';

const COVER = 'apps/demo/src/cover.ts';
const COVER_SPEC = 'apps/demo/src/cover.spec.ts';
const ICON = 'apps/demo/src/icon.svg';
const story = { project: 'demo', title: 'Open the cover', criteria: ['The cover opens'] };

class FakeTree implements ChangeTracker {
  changed: readonly string[] = [];

  async fingerprint() {
    return {};
  }

  async changedSince(): Promise<ChangedFile[]> {
    return this.changed.map((file) => ({ repository: '.', file, alreadyDirty: false }));
  }
}

function flowOver(tree: FakeTree, mandatorySteps: readonly MandatoryStep[], agents: readonly ProjectAgent[] = []): StoryFlow {
  return flowWithOptions(tree, { mandatorySteps, agents, workspaceRoot: '/workspace' });
}

function flowWithOptions(
  tree: FakeTree,
  options: { readonly mandatorySteps: readonly MandatoryStep[]; readonly agents?: readonly ProjectAgent[]; readonly workspaceRoot?: string },
): StoryFlow {
  const sheet: ProjectSheet = {
    project: 'demo',
    path: 'apps/demo',
    commitScope: 'demo',
    sheetFile: 'demo.md',
    reuses: [],
    specialist: 'agents/specialist.md',
    agents: options.agents ?? [],
    triggers: [],
    mandatorySteps: options.mandatorySteps,
    commands: {},
  };
  const graph = buildFlowGraph(
    {
      workspaceRoot: options.workspaceRoot ?? '/workspace',
      sheets: { read: async () => sheet },
      contractsDirectory: '/contracts',
      changesOf: () => tree,
      activeStories: NO_OTHER_STORIES,
    },
    new MemorySaver(),
  );
  return new StoryFlow(graph);
}

const always = (...steps: MandatoryStep['step'][]): MandatoryStep[] => steps.map((step) => ({ step, when: 'always' }));
const doneByOf = (next: Instruction | 'nothing'): string => (next === 'nothing' ? '' : next.doneBy);

describe('StoryFlow routing after a failed test validation', () => {
  it('should send the work back to the test author, who wrote the tests that prove nothing', async () => {
    const tree = new FakeTree();
    const flow = flowOver(tree, always('author-tests', 'implement', 'validate-tests', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.changed = [COVER];
    await flow.submit(storyId, { summary: 'opened the cover' });
    await flow.advanceToCommit(storyId);

    const sentBack = await flow.submit(storyId, {
      criteria: [{ criterion: 'The cover opens', test: 'opens', proven: false }],
    });

    expect(sentBack.remainingSteps[0]).toBe('author-tests');
  });

  it('should send the work back to the developer when the project has no test author step', async () => {
    const tree = new FakeTree();
    const flow = flowOver(tree, always('implement', 'validate-tests', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.changed = [COVER, COVER_SPEC];
    await flow.submit(storyId, { summary: 'opened the cover' });
    await flow.advanceToCommit(storyId);

    const sentBack = await flow.submit(storyId, {
      criteria: [{ criterion: 'The cover opens', test: 'opens', proven: false }],
    });

    expect(sentBack.remainingSteps[0]).toBe('implement');
  });

  it('should pass the validator explanation to the repair step when a criterion is unproven', async () => {
    const tree = new FakeTree();
    const flow = flowOver(tree, always('author-tests', 'implement', 'validate-tests', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.changed = [COVER];
    await flow.submit(storyId, { summary: 'opened the cover' });
    tree.changed = [COVER, COVER_SPEC];
    await flow.submit(storyId, { specFiles: [COVER_SPEC] });
    await flow.advanceToCommit(storyId);

    const sentBack = await flow.submit(storyId, {
      criteria: [{ criterion: 'The cover opens', test: 'Remove duplicate test in cover.spec.ts (T05)', proven: false }],
    });

    expect(sentBack.history.at(-1)?.details).toEqual([
      'No test proves: The cover opens — Remove duplicate test in cover.spec.ts (T05)',
    ]);
    expect(sentBack.next === 'nothing' || sentBack.next.lastResult === 'none' ? [] : sentBack.next.lastResult.details).toEqual([
      'No test proves: The cover opens — Remove duplicate test in cover.spec.ts (T05)',
    ]);
  });
});

describe('StoryFlow replanning from the change after implement', () => {
  const critic: ProjectAgent = { agent: 'motion-critic', step: 'browser-qa', when: 'ui', contract: 'skills/motion/SKILL.md' };
  const screenSteps: MandatoryStep[] = [...always('implement', 'review'), { step: 'browser-qa', when: 'ui' }];

  it('should bring a project agent into a step that a visual change needs', async () => {
    const tree = new FakeTree();
    const flow = flowOver(tree, screenSteps, [critic]);
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER, ICON], conditions: ['ui'] });
    tree.changed = [COVER, ICON];

    await flow.submit(storyId, { summary: 'opened the cover' });

    const replanned = await flow.advanceToCommit(storyId);

    expect(replanned.remainingSteps[0]).toBe('browser-qa');
    expect(doneByOf(replanned.next)).toContain('motion-critic');
  });

  it('should drop the browser check when the change turns out to touch nothing on screen', async () => {
    const tree = new FakeTree();
    const flow = flowOver(tree, screenSteps);
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: ['ui'] });
    tree.changed = [COVER];

    const replanned = await flow.submit(storyId, { summary: 'opened the cover' });

    expect(replanned.status).toBe('ready-for-commit');
    expect(replanned.remainingSteps).toEqual(['review']);
  });
});

describe('StoryFlow gathering follow-ups', () => {
  it('should report the follow-ups of the plan and of every passed step, and none of a failed one', async () => {
    const tree = new FakeTree();
    const flow = flowOver(tree, always('implement', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [], followUps: ['README still names PocketBase'] });
    tree.changed = [COVER, 'apps/demo/src/stray.ts'];
    await flow.submit(storyId, { summary: 'first try', followUps: ['never kept'] });
    tree.changed = [COVER];
    await flow.submit(storyId, { summary: 'opened the cover' });
    await flow.advanceToCommit(storyId);

    const reviewed = await flow.submit(storyId, {
      findings: [{ rule: 'W14', file: COVER, description: 'name hides intent', blocking: false }],
    });

    expect(reviewed.status).toBe('finished');
    expect(reviewed.followUps).toEqual(['README still names PocketBase', `W14 in ${COVER}: name hides intent`]);
  });
});

describe('scannableFiles', () => {
  it('should leave out the files a story deleted, which secretlint cannot read', async () => {
    const root = await mkdtemp(join(tmpdir(), 'scannable-'));
    await writeFile(join(root, 'kept.ts'), 'export {};');
    const changed = ['kept.ts', 'deleted.ts'].map((file) => ({ repository: '.', file, alreadyDirty: false }));

    expect(scannableFiles(changed, root)).toEqual(['kept.ts']);
    await rm(root, { recursive: true, force: true });
  });
});

describe('StoryFlow judgement details handed back to executing agents', () => {
  it('should send high UX findings with their screenshot to implement and keep medium/low findings as follow-ups on pass', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ux-judgement-'));
    await writeFile(join(root, 'mobile.png'), '');
    const tree = new FakeTree();
    const flow = flowWithOptions(tree, { mandatorySteps: always('implement', 'ux-critique'), workspaceRoot: root });
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.changed = [COVER];
    await flow.submit(storyId, { summary: 'opened the cover' });
    await flow.advanceToCommit(storyId);

    const rejected = await flow.submit(storyId, {
      findings: [
        { severity: 'high', description: 'Submit button clipped at 390px', screenshot: 'mobile.png' },
        { severity: 'medium', description: 'Label spacing is tight', screenshot: 'mobile.png' },
      ],
      screenshots: ['mobile.png'],
    });

    expect(rejected.remainingSteps[0]).toBe('implement');
    expect(rejected.followUps).toEqual([]);
    expect(rejected.next === 'nothing' || rejected.next.lastResult === 'none' ? [] : rejected.next.lastResult.details).toEqual([
      'Submit button clipped at 390px (mobile.png)',
    ]);

    await flow.submit(storyId, { summary: 'fixed button overflow' });
    await flow.advanceToCommit(storyId);
    const passed = await flow.submit(storyId, {
      findings: [{ severity: 'medium', description: 'Label spacing is tight', screenshot: 'mobile.png' }],
      screenshots: ['mobile.png'],
    });

    expect(passed.status).toBe('finished');
    expect(passed.followUps).toEqual(['UX (medium): Label spacing is tight']);
    await rm(root, { recursive: true, force: true });
  });

  it('should pass browser-qa and blocking review findings to implement', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa-review-'));
    await writeFile(join(root, 'qa.png'), '');
    const tree = new FakeTree();
    const flow = flowWithOptions(tree, { mandatorySteps: always('implement', 'browser-qa', 'review'), workspaceRoot: root });
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.changed = [COVER];
    await flow.submit(storyId, { summary: 'opened the cover' });
    await flow.advanceToCommit(storyId);

    const qaFailed = await flow.submit(storyId, {
      verdict: 'fail',
      findings: ['Console error on submit'],
      screenshots: ['qa.png'],
    });
    expect(qaFailed.remainingSteps[0]).toBe('implement');
    expect(qaFailed.next === 'nothing' || qaFailed.next.lastResult === 'none' ? [] : qaFailed.next.lastResult.details).toEqual([
      'Console error on submit',
    ]);

    await flow.submit(storyId, { summary: 'fixed console error' });
    await flow.advanceToCommit(storyId);
    await flow.submit(storyId, { verdict: 'pass', findings: [], screenshots: ['qa.png'] });

    const reviewFailed = await flow.submit(storyId, {
      findings: [
        { rule: 'W14', file: COVER, description: 'function does two things', blocking: true },
        { rule: 'W18', file: COVER, description: 'prefer readonly array', blocking: false },
      ],
    });
    expect(reviewFailed.remainingSteps[0]).toBe('implement');
    expect(reviewFailed.followUps).toEqual([]);
    expect(
      reviewFailed.next === 'nothing' || reviewFailed.next.lastResult === 'none' ? [] : reviewFailed.next.lastResult.details,
    ).toEqual([`W14 in ${COVER}: function does two things`]);
    await rm(root, { recursive: true, force: true });
  });
});
