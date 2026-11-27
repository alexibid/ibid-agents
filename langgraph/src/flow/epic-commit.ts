import type { ChangeTracker, Fingerprint } from '../checks/workspace-changes.js';
import { stepQueue, type Plan, type Story } from '../domain/plan.js';
import { affectsProject } from '../domain/project-scope.js';
import type { ProjectSheet } from '../domain/sheet.js';
import { inCanonicalOrder, isCommitGateStep, type StepName } from '../domain/steps.js';
import { conditionsOfFiles } from '../domain/triggers.js';
import type { FlowStateUpdate, FlowStateValue, StoryOrigin, StoryStatus } from './state.js';

export interface EpicMember {
  readonly storyId: string;
  readonly status: StoryStatus;
  readonly origin: StoryOrigin;
  readonly story: Story;
  readonly sheet: ProjectSheet;
  readonly baseline: Fingerprint;
  readonly contractsDirectory: string;
  readonly plan: Plan;
  readonly testFiles: readonly string[];
  readonly queue: readonly StepName[];
  readonly commitRequested: boolean;
  readonly epicMembers: readonly string[];
}

export interface EpicCommitOptions {
  readonly storyIds?: readonly string[];
  readonly uncommittedAmong?: (files: readonly string[]) => Promise<string[]>;
}

export interface EpicSelection {
  readonly members: readonly EpicMember[];
  readonly existingRuns: readonly EpicMember[];
}

export class EpicNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EpicNotReadyError';
  }
}

export function memberFromState(storyId: string, state: Partial<FlowStateValue>): EpicMember | undefined {
  if (state.story === undefined || state.sheet === undefined || state.baseline === undefined) {
    return undefined;
  }
  return {
    storyId,
    status: state.status ?? 'planning',
    origin: state.origin ?? { issue: '', epic: '' },
    story: state.story,
    sheet: state.sheet,
    baseline: state.baseline,
    contractsDirectory: state.contractsDirectory ?? '',
    plan: state.plan ?? { files: [], conditions: [], journey: '', reusedParts: [], brief: '' },
    testFiles: state.testFiles ?? [],
    queue: state.queue ?? [],
    commitRequested: state.commitRequested === true,
    epicMembers: state.epicMembers ?? [],
  };
}

export async function selectEpicBatch(
  epic: string,
  entries: readonly EpicMember[],
  options: EpicCommitOptions = {},
): Promise<EpicSelection> {
  const active = entries.filter((entry) => entry.origin.epic === epic && entry.status !== 'abandoned');
  const existingRuns = active.filter((entry) => entry.epicMembers.length > 0);
  const candidates = active.filter((entry) => entry.epicMembers.length === 0);
  const existingIds = new Set(existingRuns.flatMap((run) => run.epicMembers));
  const members = await chosenMembers({ epic, candidates, existingIds }, options);
  const projects = [...new Set(members.map((member) => member.story.project))];
  if (projects.length > 1) {
    throw new EpicNotReadyError(`Epic "${epic}" has ready stories across multiple projects (${projects.join(', ')}). Pass "storyIds" per project.`);
  }
  return { members, existingRuns };
}

async function chosenMembers(
  selection: { readonly epic: string; readonly candidates: readonly EpicMember[]; readonly existingIds: ReadonlySet<string> },
  options: EpicCommitOptions,
): Promise<EpicMember[]> {
  const { epic, candidates, existingIds } = selection;
  if (options.storyIds !== undefined) {
    const byId = new Map(candidates.map((candidate) => [candidate.storyId, candidate]));
    const selected = options.storyIds.map((id) => {
      const found = byId.get(id);
      if (found === undefined) {
        throw new EpicNotReadyError(`Story "${id}" does not belong to active stories of epic "${epic}".`);
      }
      if (!isCommitReadyMember(found) && found.status !== 'finished') {
        throw new EpicNotReadyError(`Story "${id}" is ${found.status}; only stories ready for commit can join an epic commit.`);
      }
      return found;
    });
    if (selected.length === 0) {
      throw new EpicNotReadyError(`No stories in epic "${epic}" were selected for commit.`);
    }
    return selected;
  }
  const selected: EpicMember[] = [];
  for (const candidate of candidates) {
    const finishedInEpic =
      candidate.status === 'finished' &&
      (options.uncommittedAmong !== undefined
        ? await hasUncommittedFiles(candidate, options.uncommittedAmong)
        : existingIds.has(candidate.storyId));
    if (isCommitReadyMember(candidate) || finishedInEpic) {
      selected.push(candidate);
    }
  }
  if (selected.length === 0) {
    throw new EpicNotReadyError(`No stories in epic "${epic}" are ready for commit.`);
  }
  return selected;
}

function isCommitReadyMember(member: EpicMember): boolean {
  return member.status === 'ready-for-commit' || (member.status === 'working' && member.commitRequested);
}

async function hasUncommittedFiles(
  member: EpicMember,
  uncommittedAmong?: (files: readonly string[]) => Promise<string[]>,
): Promise<boolean> {
  if (uncommittedAmong === undefined) {
    return false;
  }
  const files = [...new Set([...member.plan.files, ...member.testFiles])];
  return files.length > 0 && (await uncommittedAmong(files)).length > 0;
}

export async function pendingProjectFilesFor(
  members: readonly EpicMember[],
  changesOf?: (sheet: ProjectSheet) => ChangeTracker,
): Promise<{ readonly pendingFiles: readonly string[]; readonly currentFingerprint: Fingerprint }> {
  const first = members[0];
  if (first === undefined || changesOf === undefined) {
    return { pendingFiles: [], currentFingerprint: {} };
  }
  const tracker = changesOf(first.sheet);
  const currentFingerprint = await tracker.fingerprint();
  const ownFiles = [...new Set(members.flatMap((member) => [...member.plan.files, ...member.testFiles]))];
  const baseline = epicBaselineOf(members, new Set(ownFiles));
  const changed = await tracker.changedSince(baseline);
  const pendingFiles = changed.map(({ file }) => file).filter((file) => affectsProject(file, first.sheet, ownFiles));
  return { pendingFiles, currentFingerprint };
}

export function sameMemberSet(first: readonly string[], second: readonly string[]): boolean {
  if (first.length !== second.length) {
    return false;
  }
  const sortedFirst = [...first].sort();
  const sortedSecond = [...second].sort();
  return sortedFirst.every((id, index) => id === sortedSecond[index]);
}

export interface EpicSeedInput {
  readonly epic: string;
  readonly members: readonly EpicMember[];
  readonly pendingFiles: readonly string[];
  readonly currentFingerprint: Fingerprint;
}

export function epicCommitUpdate({
  epic,
  members,
  pendingFiles,
  currentFingerprint,
}: EpicSeedInput): { readonly update: FlowStateUpdate; readonly story: Story } {
  const first = members[0];
  if (first === undefined) {
    throw new EpicNotReadyError(`No stories in epic "${epic}" are ready for commit.`);
  }
  const files = [...new Set(members.flatMap((member) => member.plan.files))];
  const testFiles = [...new Set(members.flatMap((member) => member.testFiles))];
  const conditions = inConditionsOrder(members, [...files, ...pendingFiles], first.sheet);
  const queue = inCanonicalOrder(stepQueue(first.sheet, conditions));
  const startPosition = queue.findIndex(isCommitGateStep);
  const position = startPosition === -1 ? queue.length : startPosition;
  const story = combinedStory(epic, members);
  return {
    story,
    update: {
      story,
      origin: { issue: '', epic },
      epicMembers: members.map(({ storyId }) => storyId),
      sheet: first.sheet,
      baseline: epicBaselineOf(members, new Set([...files, ...testFiles])),
      implementBaseline: currentFingerprint,
      contractsDirectory: first.contractsDirectory,
      plan: {
        files,
        conditions,
        journey: members.map((member) => member.plan.journey).find((journey) => journey.trim() !== '') ?? '',
        reusedParts: [...new Set(members.flatMap((member) => member.plan.reusedParts))],
        brief: epicBriefOf(members),
      },
      testFiles,
      queue,
      position,
      commitRequested: true,
      commitConfirmed: false,
      status: position >= queue.length ? 'finished' : 'working',
      lastPasses: queue.includes('author-tests') ? { 'author-tests': currentFingerprint } : {},
    },
  };
}

function inConditionsOrder(members: readonly EpicMember[], allFiles: readonly string[], sheet: ProjectSheet) {
  const declared = new Set(members.flatMap((member) => member.plan.conditions));
  const triggered = new Set(conditionsOfFiles(allFiles, sheet));
  return [...new Set([...declared, ...triggered])];
}

function combinedStory(epic: string, members: readonly EpicMember[]): Story {
  const project = members[0]?.story.project ?? '';
  const criteria = [...new Set(members.flatMap((member) => member.story.criteria))];
  return {
    project,
    title: `Commit epic ${epic} (${members.length} ${members.length === 1 ? 'story' : 'stories'})`,
    criteria,
  };
}

function epicBriefOf(members: readonly EpicMember[]): string {
  return members
    .map((member) => {
      const label = member.origin.issue !== '' ? `${member.storyId} (${member.origin.issue})` : member.storyId;
      const brief = member.plan.brief.trim();
      return brief === '' ? `${label}: ${member.story.title}` : `${label}: ${member.story.title}\n${brief}`;
    })
    .join('\n\n');
}

function epicBaselineOf(members: readonly EpicMember[], ownFiles: ReadonlySet<string>): Fingerprint {
  const result: Record<string, string> = {};
  for (const member of members) {
    for (const [file, hash] of Object.entries(member.baseline)) {
      if (!ownFiles.has(file) || members.every((candidate) => file in candidate.baseline)) {
        result[file] ??= hash;
      }
    }
  }
  return result;
}
