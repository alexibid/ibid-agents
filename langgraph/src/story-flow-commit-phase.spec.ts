import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';
import type { ChangeTracker, ChangedFile, Fingerprint } from './checks/workspace-changes.js';
import { NO_OTHER_STORIES } from './domain/concurrent-stories.js';
import type { MandatoryStep, ProjectSheet } from './domain/sheet.js';
import { buildFlowGraph } from './flow/graph.js';
import { StoryFlow } from './story-flow.js';

const COVER = 'apps/demo/src/cover.ts';
const COVER_VIEW = 'apps/demo/src/cover.html';
const COVER_SPEC = 'apps/demo/src/cover.spec.ts';
const E2E_SPEC = 'apps/demo/e2e/cover.spec.ts';
const story = { project: 'demo', title: 'Open the cover', criteria: ['The cover opens'] };

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

function flowOver(tree: EditedTree, mandatorySteps: readonly MandatoryStep[], workspaceRoot = '/workspace'): StoryFlow {
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
    commands: {},
  };
  const graph = buildFlowGraph(
    { workspaceRoot, sheets: { read: async () => sheet }, contractsDirectory: '/contracts', changesOf: () => tree, activeStories: NO_OTHER_STORIES },
    new MemorySaver(),
  );
  return new StoryFlow(graph);
}

const always = (...steps: MandatoryStep['step'][]): MandatoryStep[] => steps.map((step) => ({ step, when: 'always' }));
const stepOf = (report: Awaited<ReturnType<StoryFlow['report']>>): string => (report.next === 'nothing' ? 'nothing' : report.next.step);

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

describe('StoryFlow commit phase stays in commit and never stops on MAX_ATTEMPTS', () => {
  it('should stay in commit phase and resume verification after a repair triggered by a commit step', async () => {
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

    expect(repaired.status).toBe('working');
    expect(repaired.phase).toBe('commit');
    expect(stepOf(repaired)).toBe('validate-tests');
  });

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

  it('should never stop as needs-user when browser-qa and its implement repair loop exceed 3 attempts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'qa-unlimited-'));
    await writeFile(join(root, 'qa.png'), '');
    const tree = new EditedTree();
    const flow = flowOver(tree, [...always('implement', 'author-tests', 'validate-tests', 'review'), { step: 'browser-qa', when: 'ui' }], root);
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER, COVER_VIEW], conditions: ['ui'] });
    tree.edit(COVER, COVER_VIEW);
    await flow.submit(storyId, { summary: 'opened the cover' });
    tree.edit(COVER_SPEC);
    await flow.submit(storyId, { specFiles: [COVER_SPEC] });
    await flow.advanceToCommit(storyId);
    await flow.submit(storyId, { criteria: [{ criterion: 'The cover opens', test: 'opens the cover', proven: true }] });

    for (const attempt of [1, 2, 3, 4]) {
      const qaFailed = await flow.submit(storyId, { verdict: 'fail', findings: [`QA fail ${attempt}`], screenshots: ['qa.png'] });
      expect(qaFailed.status).toBe('working');
      expect(qaFailed.phase).toBe('commit');
      expect(stepOf(qaFailed)).toBe('implement');
      expect(qaFailed.attempts['browser-qa']).toBe(attempt);

      tree.edit(E2E_SPEC);
      const afterRepair = await flow.submit(storyId, { summary: `fixed e2e attempt ${attempt}` });
      expect(afterRepair.status).toBe('working');
      expect(afterRepair.phase).toBe('commit');
      expect(stepOf(afterRepair)).toBe('browser-qa');
    }

    await flow.submit(storyId, { verdict: 'pass', findings: [], screenshots: ['qa.png'] });
    const finished = await flow.submit(storyId, { findings: [] });
    expect(finished.status).toBe('finished');
    await rm(root, { recursive: true, force: true });
  });

  it('should keep repair implement, validate-tests, ux-critique, review, and final-verification running past 3 failures in commit phase', async () => {
    const root = await mkdtemp(join(tmpdir(), 'commit-unlimited-'));
    await writeFile(join(root, 'ux.png'), '');
    const tree = new EditedTree();
    const flow = flowOver(tree, always('implement', 'author-tests', 'validate-tests', 'ux-critique', 'review', 'final-verification'), root);
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.edit(COVER);
    await flow.submit(storyId, { summary: 'opened the cover' });
    tree.edit(COVER_SPEC);
    await flow.submit(storyId, { specFiles: [COVER_SPEC] });
    await flow.advanceToCommit(storyId);

    for (const attempt of [1, 2, 3, 4]) {
      const invalid = await flow.submit(storyId, { criteria: [{ criterion: 'The cover opens', test: `gap ${attempt}`, proven: false }] });
      expect(invalid.status).toBe('working');
      expect(invalid.phase).toBe('commit');
      expect(stepOf(invalid)).toBe('author-tests');
      tree.edit(COVER_SPEC);
      await flow.submit(storyId, { specFiles: [COVER_SPEC] });
    }
    await flow.submit(storyId, { criteria: [{ criterion: 'The cover opens', test: 'opens', proven: true }] });

    await flow.submit(storyId, { findings: [{ severity: 'high', description: 'clipped', screenshot: 'ux.png' }], screenshots: ['ux.png'] });
    for (const attempt of [1, 2, 3, 4]) {
      const noChange = await flow.submit(storyId, { summary: `empty repair ${attempt}` });
      expect(noChange.status).toBe('working');
      expect(noChange.phase).toBe('commit');
      expect(stepOf(noChange)).toBe('implement');
    }
    tree.edit(COVER);
    await flow.submit(storyId, { summary: 'fixed ux' });
    await flow.submit(storyId, { criteria: [{ criterion: 'The cover opens', test: 'opens', proven: true }] });
    await flow.submit(storyId, { findings: [], screenshots: ['ux.png'] });

    for (const attempt of [1, 2, 3, 4]) {
      const rejected = await flow.submit(storyId, { findings: [{ rule: 'W14', file: COVER, description: `fix ${attempt}`, blocking: true }] });
      expect(rejected.status).toBe('working');
      expect(stepOf(rejected)).toBe('implement');
      tree.edit(COVER);
      await flow.submit(storyId, { summary: `review fix ${attempt}` });
      await flow.submit(storyId, { criteria: [{ criterion: 'The cover opens', test: 'opens', proven: true }] });
      await flow.submit(storyId, { findings: [], screenshots: ['ux.png'] });
    }
    await flow.submit(storyId, { findings: [] });

    for (const attempt of [1, 2, 3, 4]) {
      const badHandover = await flow.submit(storyId, { wrong: attempt });
      expect(badHandover.status).toBe('working');
      expect(badHandover.phase).toBe('commit');
      expect(stepOf(badHandover)).toBe('final-verification');
    }
    await rm(root, { recursive: true, force: true });
  });

  it('should still pause as needs-user when an agent asks a genuine question in commit phase and resume in commit phase', async () => {
    const tree = new EditedTree();
    const flow = flowOver(tree, always('implement', 'author-tests', 'validate-tests', 'review'));
    const { storyId } = await flow.startStory(story);
    await flow.submit(storyId, { files: [COVER], conditions: [] });
    tree.edit(COVER);
    await flow.submit(storyId, { summary: 'opened the cover' });
    tree.edit(COVER_SPEC);
    await flow.submit(storyId, { specFiles: [COVER_SPEC] });
    await flow.advanceToCommit(storyId);
    await flow.submit(storyId, { criteria: [{ criterion: 'The cover opens', test: 'opens', proven: true }] });

    const asked = await flow.submit(storyId, { findings: [], questions: ['Should W14 apply to legacy helper?'] });
    expect(asked.status).toBe('needs-user');
    expect(asked.phase).toBe('commit');

    const resumed = await flow.resume(storyId, 'Ignore legacy helper.');
    expect(resumed.status).toBe('working');
    expect(resumed.phase).toBe('commit');
    expect(stepOf(resumed)).toBe('review');
  });
});
