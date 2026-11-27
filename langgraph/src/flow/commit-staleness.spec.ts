import { describe, expect, it } from 'vitest';
import type { ChangeTracker, ChangedFile, Fingerprint } from '../checks/workspace-changes.js';
import type { ActiveStories } from '../domain/concurrent-stories.js';
import type { ProjectSheet } from '../domain/sheet.js';
import { earliestStaleCommitStep, sameFingerprint } from './commit-staleness.js';
import { ONLY_TESTS_CHANGED, REVIEW_KEPT, SCREEN_UNCHANGED, VALIDATION_KEPT, isStepStale, skipReasonFor } from './repeat-skips.js';

const SCSS = 'apps/demo/src/book.scss';
const TS = 'apps/demo/src/cover.ts';
const SPEC = 'apps/demo/src/cover.spec.ts';
const E2E_SPEC = 'apps/demo/e2e/contact-layout.spec.ts';
const E2E_PAGE = 'apps/demo/e2e/pages/contact.page.ts';
const OTHER_APP = 'apps/other/src/other.scss';
const QUICK_SCSS = 'apps/demo/src/_base.scss';

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
    { step: 'implement', when: 'always' },
    { step: 'author-tests', when: 'always' },
    { step: 'build', when: 'always' },
    { step: 'lint', when: 'always' },
    { step: 'rule-checks', when: 'always' },
    { step: 'unit-tests', when: 'always' },
    { step: 'validate-tests', when: 'always' },
    { step: 'browser-qa', when: 'ui' },
    { step: 'ux-critique', when: 'ui' },
    { step: 'review', when: 'always' },
    { step: 'final-verification', when: 'always' },
  ],
  commands: {},
};

const change = (file: string): ChangedFile => ({ repository: '.', file, alreadyDirty: false });

class VersionedFake implements ChangeTracker {
  private readonly map = new Map<string, number>();

  edit(...files: string[]): void {
    for (const file of files) {
      this.map.set(file, (this.map.get(file) ?? 0) + 1);
    }
  }

  async fingerprint(): Promise<Fingerprint> {
    return Object.fromEntries([...this.map.entries()].map(([file, count]) => [file, String(count)]));
  }

  async changedSince(since: Fingerprint): Promise<ChangedFile[]> {
    return [...this.map.entries()]
      .filter(([file, count]) => String(count) !== since[file])
      .map(([file]) => change(file));
  }
}

describe('isStepStale and skipReasonFor', () => {
  it('should treat build and browser-qa as stale on a concurrent scss edit while keeping validate-tests and review skipped', () => {
    const changes = { projectChanged: [change(QUICK_SCSS)], storyChanged: [], sheet };

    expect(isStepStale('build', changes)).toBe(true);
    expect(isStepStale('lint', changes)).toBe(true);
    expect(isStepStale('unit-tests', changes)).toBe(true);
    expect(isStepStale('browser-qa', changes)).toBe(true);
    expect(isStepStale('ux-critique', changes)).toBe(true);
    expect(isStepStale('validate-tests', changes)).toBe(false);
    expect(isStepStale('review', changes)).toBe(false);

    expect(skipReasonFor('validate-tests', changes)).toBe(VALIDATION_KEPT);
    expect(skipReasonFor('review', changes)).toBe(REVIEW_KEPT);
  });

  it('should skip build and screen checks when only a spec file changed while still running lint, unit-tests, and validate-tests', () => {
    const changes = { projectChanged: [change(SPEC)], storyChanged: [change(SPEC)], sheet };

    expect(isStepStale('build', changes)).toBe(false);
    expect(isStepStale('browser-qa', changes)).toBe(false);
    expect(isStepStale('lint', changes)).toBe(true);
    expect(isStepStale('unit-tests', changes)).toBe(true);
    expect(isStepStale('validate-tests', changes)).toBe(true);

    expect(skipReasonFor('build', changes)).toBe(ONLY_TESTS_CHANGED);
    expect(skipReasonFor('browser-qa', changes)).toBe(SCREEN_UNCHANGED);
  });
});

describe('earliestStaleCommitStep', () => {
  const queue = sheet.mandatorySteps.map(({ step }) => step);
  const quickChangeStories: ActiveStories = {
    besides: async () => [],
    changedAlongside: async () => [{ storyId: 'quick-change~1', files: [QUICK_SCSS] }],
  };

  it('should rewind to build when a concurrent quick-change modifies an scss file after earlier checks passed', async () => {
    const tracker = new VersionedFake();
    tracker.edit(TS);
    const passFp = await tracker.fingerprint();
    tracker.edit(QUICK_SCSS);
    const currentFingerprint = await tracker.fingerprint();

    const stale = await earliestStaleCommitStep({
      queue,
      position: queue.indexOf('final-verification'),
      lastPasses: { build: passFp, lint: passFp, 'unit-tests': passFp, 'browser-qa': passFp, review: passFp },
      currentFingerprint,
      scope: { storyId: 'demo-1', sheet, ownFiles: [TS, SPEC], tracker, activeStories: quickChangeStories },
    });

    expect(queue[stale ?? -1]).toBe('build');
  });

  it('should skip build and rewind only to lint when only a spec file changed', async () => {
    const tracker = new VersionedFake();
    tracker.edit(TS);
    const passFp = await tracker.fingerprint();
    tracker.edit(SPEC);
    const currentFingerprint = await tracker.fingerprint();

    const stale = await earliestStaleCommitStep({
      queue,
      position: queue.indexOf('review'),
      lastPasses: { build: passFp, lint: passFp, 'unit-tests': passFp, 'validate-tests': passFp },
      currentFingerprint,
      scope: { storyId: 'demo-1', sheet, ownFiles: [TS, SPEC], tracker, activeStories: quickChangeStories },
    });

    expect(queue[stale ?? -1]).toBe('lint');
  });

  it('should ignore changes in unrelated apps', async () => {
    const tracker = new VersionedFake();
    tracker.edit(TS);
    const passFp = await tracker.fingerprint();
    tracker.edit(OTHER_APP);
    const currentFingerprint = await tracker.fingerprint();

    const stale = await earliestStaleCommitStep({
      queue,
      position: queue.length,
      lastPasses: { build: passFp, lint: passFp, 'unit-tests': passFp, 'browser-qa': passFp, 'final-verification': passFp },
      currentFingerprint,
      scope: { storyId: 'demo-1', sheet, ownFiles: [TS, SPEC], tracker, activeStories: quickChangeStories },
    });

    expect(stale).toBeUndefined();
    expect(sameFingerprint(passFp, passFp)).toBe(true);
    expect(SCSS).toContain('book');
  });

  it('should skip build, unit-tests, and validate-tests when only e2e files change while still running lint and browser-qa', async () => {
    const changes = { projectChanged: [change(E2E_SPEC), change(E2E_PAGE)], storyChanged: [change(E2E_SPEC)], sheet };

    expect(isStepStale('build', changes)).toBe(false);
    expect(isStepStale('seo-audit', changes)).toBe(false);
    expect(isStepStale('unit-tests', changes)).toBe(false);
    expect(isStepStale('validate-tests', changes)).toBe(false);
    expect(isStepStale('lint', changes)).toBe(true);
    expect(isStepStale('browser-qa', changes)).toBe(true);
    expect(isStepStale('journey', changes)).toBe(true);
  });

  it('should keep validate-tests skipped when only scss changes in the story while keeping unit-tests stale', async () => {
    const changes = { projectChanged: [change(SCSS)], storyChanged: [change(SCSS)], ownChanged: [change(SCSS)], sheet };

    expect(isStepStale('validate-tests', changes)).toBe(false);
    expect(skipReasonFor('validate-tests', changes)).toBe(VALIDATION_KEPT);
    expect(isStepStale('unit-tests', changes)).toBe(true);
  });

  it('should rewind only to lint on an e2e fix after earlier checks passed', async () => {
    const tracker = new VersionedFake();
    tracker.edit(TS);
    const passFp = await tracker.fingerprint();
    tracker.edit(E2E_SPEC);
    const currentFingerprint = await tracker.fingerprint();

    const stale = await earliestStaleCommitStep({
      queue,
      position: queue.indexOf('browser-qa'),
      lastPasses: { build: passFp, lint: passFp, 'unit-tests': passFp, 'validate-tests': passFp },
      currentFingerprint,
      scope: { storyId: 'demo-1', sheet, ownFiles: [TS, SPEC, E2E_SPEC], tracker, activeStories: quickChangeStories },
    });

    expect(queue[stale ?? -1]).toBe('lint');
  });
});
