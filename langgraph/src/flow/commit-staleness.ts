import type { ChangedFile, ChangeTracker, Fingerprint } from '../checks/workspace-changes.js';
import { NO_OTHER_STORIES, ownChanges, type ActiveStories } from '../domain/concurrent-stories.js';
import { affectsProject } from '../domain/project-scope.js';
import type { ProjectSheet } from '../domain/sheet.js';
import { isCommitGateStep, type StepName } from '../domain/steps.js';
import { isStepStale, isValidationRelevant, type StepChanges } from './repeat-skips.js';
import type { FlowStateValue } from './state.js';

export interface ChangeScope {
  readonly storyId: string;
  readonly sheet: ProjectSheet;
  readonly ownFiles: readonly string[];
  readonly tracker: ChangeTracker;
  readonly activeStories: ActiveStories;
}

export interface StalenessQuery {
  readonly queue: readonly StepName[];
  readonly position: number;
  readonly lastPasses: Readonly<Record<string, Fingerprint>>;
  readonly currentFingerprint: Fingerprint;
  readonly scope: ChangeScope;
}

export function sameFingerprint(first: Fingerprint, second: Fingerprint): boolean {
  const keys = Object.keys(first);
  return keys.length === Object.keys(second).length && keys.every((key) => first[key] === second[key]);
}

export async function projectChangesSince(since: Fingerprint, scope: ChangeScope): Promise<ChangedFile[]> {
  const changed = await scope.tracker.changedSince(since);
  return changed.filter(({ file }) => affectsProject(file, scope.sheet, scope.ownFiles));
}

export async function storyChangesSince(since: Fingerprint, scope: ChangeScope): Promise<ChangedFile[]> {
  const projectChanged = await projectChangesSince(since, scope);
  const others = await scope.activeStories.changedAlongside(scope.storyId);
  return ownChanges(projectChanged, scope.ownFiles, others);
}

export async function stepChangesSince(since: Fingerprint, scope: ChangeScope): Promise<StepChanges> {
  const projectChanged = await projectChangesSince(since, scope);
  const others = await scope.activeStories.changedAlongside(scope.storyId);
  const storyChanged = ownChanges(projectChanged, scope.ownFiles, others);
  const ownChanged = projectChanged.filter(({ file }) => scope.ownFiles.includes(file));
  return { projectChanged, storyChanged, ownChanged, sheet: scope.sheet };
}

export async function changedProjectFilesSince(
  lastPass: Fingerprint | undefined,
  scope: ChangeScope,
): Promise<ChangedFile[] | undefined> {
  return lastPass === undefined ? undefined : projectChangesSince(lastPass, scope);
}

export async function changedValidationFilesSince(lastPass: Fingerprint | undefined, scope: ChangeScope): Promise<string[]> {
  if (lastPass === undefined) {
    return [];
  }
  const { ownChanged, storyChanged } = await stepChangesSince(lastPass, scope);
  return (ownChanged ?? storyChanged).map(({ file }) => file).filter(isValidationRelevant);
}

export async function earliestStaleCommitStep(query: StalenessQuery): Promise<number | undefined> {
  const limit = Math.min(query.position, query.queue.length);
  const memo = new Map<string, StepChanges>();
  for (let index = 0; index < limit; index += 1) {
    const step = query.queue[index];
    if (step === undefined || !isCommitGateStep(step)) {
      continue;
    }
    const pass = query.lastPasses[step] ?? fallbackPass(index, query);
    if (pass === undefined || sameFingerprint(query.currentFingerprint, pass)) {
      continue;
    }
    const changes = await cachedChanges(pass, query.scope, memo);
    if (isStepStale(step, changes)) {
      return index;
    }
  }
  return undefined;
}

export interface StalenessDependencies {
  readonly changesOf?: (sheet: ProjectSheet) => ChangeTracker;
  readonly activeStories?: ActiveStories;
}

export async function stalePositionOf(
  state: Partial<FlowStateValue>,
  storyId: string,
  dependencies: StalenessDependencies,
): Promise<number | undefined> {
  if (dependencies.changesOf === undefined || state.sheet === undefined || state.queue === undefined) {
    return undefined;
  }
  const tracker = dependencies.changesOf(state.sheet);
  const currentFingerprint = await tracker.fingerprint();
  const position = state.status === 'finished' ? state.queue.length : (state.position ?? 0);
  const ownFiles = [...(state.plan?.files ?? []), ...(state.testFiles ?? [])];
  return earliestStaleCommitStep({
    queue: state.queue,
    position,
    lastPasses: state.lastPasses ?? {},
    currentFingerprint,
    scope: {
      storyId,
      sheet: state.sheet,
      ownFiles,
      tracker,
      activeStories: dependencies.activeStories ?? NO_OTHER_STORIES,
    },
  });
}

function fallbackPass(index: number, { queue, lastPasses }: StalenessQuery): Fingerprint | undefined {
  for (let prior = index - 1; prior >= 0; prior -= 1) {
    const earlier = queue[prior];
    const pass = earlier === undefined ? undefined : lastPasses[earlier];
    if (pass !== undefined) {
      return pass;
    }
  }
  return undefined;
}

async function cachedChanges(since: Fingerprint, scope: ChangeScope, memo: Map<string, StepChanges>): Promise<StepChanges> {
  const key = fingerprintKey(since);
  const cached = memo.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const computed = await stepChangesSince(since, scope);
  memo.set(key, computed);
  return computed;
}

function fingerprintKey(fingerprint: Fingerprint): string {
  return JSON.stringify(
    Object.keys(fingerprint)
      .sort()
      .map((key) => [key, fingerprint[key]]),
  );
}
