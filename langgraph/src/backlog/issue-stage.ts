import type { StoryStatus } from '../flow/state.js';

export type IssueStage = 'building' | 'ready-for-commit' | 'verifying' | 'blocked' | 'awaiting-commit' | 'stopped' | 'done';

export type StoryPhase = 'building' | 'commit';

export interface StageLabel {
  readonly name: string;
  readonly color: string;
  readonly description: string;
}

export const STATUS_MARKER = '<!-- story-status -->';

export const EPIC_IN_PROGRESS: StageLabel = { name: 'status: in progress', color: '1d76db', description: 'Work has started' };

const STAGE_LABELS: Readonly<Record<IssueStage, StageLabel | 'none'>> = {
  building: { name: 'status: building', color: '1d76db', description: 'The change and its tests are being written' },
  'ready-for-commit': { name: 'status: ready for commit', color: '0e8a16', description: 'Written and built; waiting to be committed' },
  verifying: { name: 'status: verifying', color: 'fbca04', description: 'Tests, review and final checks are running' },
  blocked: { name: 'status: blocked', color: 'b60205', description: 'Waiting for a decision' },
  'awaiting-commit': { name: 'status: awaiting commit', color: '0e8a16', description: 'Verified; waiting for the commit' },
  stopped: 'none',
  done: 'none',
};

const STAGE_TEXT: Readonly<Record<IssueStage, string>> = {
  building: 'Building: the change and its tests are being written.',
  'ready-for-commit': 'Ready for commit: the change and its tests are written. Nothing has been run or judged yet; that happens once the commit is requested.',
  verifying: 'Verifying: tests, review and the final checks are running.',
  blocked: 'Blocked: a step failed three times and is waiting for a decision.',
  'awaiting-commit': 'Verified: every check passed. Waiting for the commit.',
  stopped: 'Stopped: work on this story was stopped. Its changes stay in the working tree.',
  done: 'Done: the change is committed.',
};

export const ALL_STATUS_LABELS: readonly StageLabel[] = Object.values(STAGE_LABELS).flatMap((label) => (label === 'none' ? [] : [label]));

export function stageOf(status: StoryStatus, phase: StoryPhase): IssueStage {
  switch (status) {
    case 'planning':
      return 'building';
    case 'working':
      return phase === 'commit' ? 'verifying' : 'building';
    case 'ready-for-commit':
      return 'ready-for-commit';
    case 'needs-user':
      return 'blocked';
    case 'finished':
      return 'awaiting-commit';
    case 'abandoned':
      return 'stopped';
  }
}

export function labelOf(stage: IssueStage): StageLabel | 'none' {
  return STAGE_LABELS[stage];
}

export function statusCommentOf(stage: IssueStage, on: Date): string {
  return `**Status:** ${STAGE_TEXT[stage]}\n\n_Updated ${on.toISOString().slice(0, 16).replace('T', ' ')} UTC_\n\n${STATUS_MARKER}`;
}
