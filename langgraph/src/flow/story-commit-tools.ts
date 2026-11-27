import { linkedIssuesIn, repositoriesOf, type DecisionRunRecord } from '../agent-runs/decision-issues.js';
import type { StoryFlow, StoryReport } from '../story-flow.js';
import type { StoryOrigin } from './state.js';
import type { StoryWorkspace } from './story-tools.js';

export interface IssueWorkAttempt {
  readonly agent: string;
  readonly request: string;
  readonly issue: string;
  readonly epic: string;
}

export class PendingCommitConfirmationError extends Error {
  constructor(storyId: string, origin: StoryOrigin, agent: string) {
    const target = origin.epic !== '' ? `epic ${origin.epic}` : origin.issue !== '' ? `issue ${origin.issue}` : storyId;
    const confirmTool = origin.epic !== '' ? 'confirm_epic_commit' : 'confirm_commit';
    super(
      `Story "${storyId}" (${target}) is finished and waiting for the user's commit and confirmation. Deliver the commit commands from final-verification first (after /devops when required), wait for the user to commit, and call ${confirmTool} before starting /${agent}.`,
    );
    this.name = 'PendingCommitConfirmationError';
  }
}

const ISSUE_AGENTS: ReadonlySet<string> = new Set(['project-manager', 'issue-review']);
const REPO_PATTERN = /(?:^|[^\w/])([\w.-]+\/[\w.-]+)\b/;
const FOLLOW_UP_REQUEST = /\bfollow[- ]?ups?\b|\bfinished\b|\bawaiting[- ]commit\b/i;
const POST_FINISH_PM_HINT = /\bfollow[- ]?ups?\b|\bfinished\b|\bawaiting[- ]commit\b|\bclose\b|\bfechar\b/i;

export async function advanceSingleStory(
  storyFlow: StoryFlow,
  workspace: StoryWorkspace,
  storyId: string,
): Promise<StoryReport> {
  const report = await storyFlow.report(storyId);
  if ((report.epicMembers?.length ?? 0) === 0 && report.origin.epic !== '') {
    const reports = await allReports(storyFlow, workspace);
    const readyInEpic = reports.filter(
      (candidate) =>
        (candidate.epicMembers?.length ?? 0) === 0 &&
        candidate.origin.epic === report.origin.epic &&
        (candidate.status === 'ready-for-commit' || (candidate.status === 'working' && candidate.phase === 'commit')),
    );
    if (readyInEpic.length > 1) {
      throw new Error(
        `Story "${storyId}" belongs to epic ${report.origin.epic}, which has ${readyInEpic.length} stories ready to commit. Use advance_epic_to_commit so tests, validation, QA, UX, review, and final verification run once for the whole epic.`,
      );
    }
  }
  return storyFlow.advanceToCommit(storyId);
}

export async function confirmStoryOrEpic(
  storyFlow: StoryFlow,
  workspace: StoryWorkspace,
  storyId: string,
): Promise<{ readonly single?: StoryReport; readonly epic?: string; readonly confirmed?: readonly StoryReport[] }> {
  const report = await storyFlow.report(storyId);
  if ((report.epicMembers?.length ?? 0) > 0) {
    const confirmed = await storyFlow.confirmEpicCommit(
      report.origin.epic,
      [storyId, ...(report.epicMembers ?? [])],
      workspace.uncommittedAmong,
    );
    return { epic: report.origin.epic, confirmed };
  }
  if (report.origin.epic !== '') {
    const reports = await allReports(storyFlow, workspace);
    const epicRun = reports.find(
      (candidate) =>
        candidate.status === 'finished' &&
        candidate.origin.epic === report.origin.epic &&
        (candidate.epicMembers?.length ?? 0) > 0 &&
        (candidate.epicMembers ?? []).includes(storyId),
    );
    if (epicRun !== undefined) {
      const confirmed = await storyFlow.confirmEpicCommit(
        report.origin.epic,
        [epicRun.storyId, ...(epicRun.epicMembers ?? [])],
        workspace.uncommittedAmong,
      );
      return { epic: report.origin.epic, confirmed };
    }
  }
  return { single: await storyFlow.confirmCommit(storyId, await workspace.uncommittedAmong(report.files)) };
}

export async function ensureCommitConfirmedBeforeIssueWork(
  storyFlow: StoryFlow,
  workspace: StoryWorkspace,
  attempt: IssueWorkAttempt,
): Promise<void> {
  if (!ISSUE_AGENTS.has(attempt.agent)) {
    return;
  }
  const reports = await allReports(storyFlow, workspace);
  const unconfirmed = prioritizeEpicRuns(await unconfirmedFinishedReports(reports, workspace));
  if (unconfirmed.length === 0) {
    return;
  }
  const decisionRuns = workspace.decisionRuns?.() ?? [];
  const blocker = unconfirmed.find((candidate) => blocksAttempt(candidate, attempt, decisionRuns));
  if (blocker !== undefined) {
    throw new PendingCommitConfirmationError(blocker.storyId, blocker.origin, attempt.agent);
  }
}

async function allReports(storyFlow: StoryFlow, workspace: StoryWorkspace): Promise<StoryReport[]> {
  const reports = await Promise.all(workspace.storyIds().map((id) => storyFlow.report(id).catch(() => undefined)));
  return reports.filter((entry): entry is StoryReport => entry !== undefined);
}

async function unconfirmedFinishedReports(reports: readonly StoryReport[], workspace: StoryWorkspace): Promise<StoryReport[]> {
  const finished = reports.filter(
    (entry) => entry.status === 'finished' && (entry.files.length > 0 || (entry.epicMembers?.length ?? 0) > 0),
  );
  const results: StoryReport[] = [];
  for (const entry of finished) {
    if (await isUnconfirmed(entry, reports, workspace)) {
      results.push(entry);
    }
  }
  return results;
}

async function isUnconfirmed(report: StoryReport, reports: readonly StoryReport[], workspace: StoryWorkspace): Promise<boolean> {
  if (report.commitConfirmed === true) {
    return false;
  }
  if (report.commitConfirmed === false) {
    if ((report.epicMembers?.length ?? 0) === 0) {
      return true;
    }
    const membersConfirmed = (report.epicMembers ?? []).every(
      (memberId) => reports.find(({ storyId }) => storyId === memberId)?.commitConfirmed === true,
    );
    return !membersConfirmed || (await workspace.uncommittedAmong(report.files)).length > 0;
  }
  if (report.origin.issue === '' && report.origin.epic === '') {
    return false;
  }
  return (await workspace.uncommittedAmong(report.files)).length > 0;
}

function prioritizeEpicRuns(unconfirmed: readonly StoryReport[]): StoryReport[] {
  const covered = new Set(unconfirmed.flatMap((entry) => entry.epicMembers ?? []));
  return unconfirmed.filter((entry) => (entry.epicMembers?.length ?? 0) > 0 || !covered.has(entry.storyId));
}

function blocksAttempt(blocker: StoryReport, attempt: IssueWorkAttempt, decisionRuns: readonly DecisionRunRecord[]): boolean {
  const attemptIssues = linkedIssuesIn(attempt.request, { issue: attempt.issue, epic: attempt.epic });
  const attemptRepos = repositoriesOf(attemptIssues);
  const sameArea = mentionsProjectOrRepo(attempt.request, attemptRepos, blocker);
  const anyRepo = mentionsAnyRepository(attempt.request, attemptRepos);
  const mentionsBlocker = referencesStoryOrOrigin(attempt.request, { attemptIssues, blocker, matchBareNumber: sameArea || !anyRepo });
  if (isIndependentDecisionRun(blocker, attempt, decisionRuns)) {
    return false;
  }
  if (attempt.agent === 'issue-review') {
    return mentionsBlocker || sameArea || !anyRepo;
  }
  if (mentionsBlocker) {
    return true;
  }
  if (sameArea && POST_FINISH_PM_HINT.test(attempt.request)) {
    return true;
  }
  return !anyRepo && FOLLOW_UP_REQUEST.test(attempt.request);
}

function isIndependentDecisionRun(
  blocker: StoryReport,
  attempt: IssueWorkAttempt,
  decisionRuns: readonly DecisionRunRecord[],
): boolean {
  const attemptIssues = linkedIssuesIn(attempt.request, { issue: attempt.issue, epic: attempt.epic });
  if (attemptIssues.length === 0 || FOLLOW_UP_REQUEST.test(attempt.request)) {
    return false;
  }
  const blockerIssues = [blocker.origin.issue, blocker.origin.epic].filter((url) => url !== '');
  if (attemptIssues.some((url) => blockerIssues.includes(url))) {
    return false;
  }
  return decisionRuns.some(
    (run) =>
      run.followUpStatus === 'pending' &&
      !run.linkedIssues.some((url) => blockerIssues.includes(url)) &&
      attemptIssues.every((url) => run.linkedIssues.includes(url)),
  );
}

function mentionsProjectOrRepo(request: string, attemptRepos: readonly string[], blocker: StoryReport): boolean {
  const blockerRepos = repositoriesOf([blocker.origin.issue, blocker.origin.epic]);
  const repoMatch = blockerRepos.some(
    (repo) => attemptRepos.includes(repo) || textMentionsName(request, repo) || textMentionsName(request, repo.split('/')[1] ?? ''),
  );
  if (repoMatch) {
    return true;
  }
  const project = blocker.project ?? '';
  return project !== '' && textMentionsName(request, project);
}

function referencesStoryOrOrigin(
  request: string,
  context: { readonly attemptIssues: readonly string[]; readonly blocker: StoryReport; readonly matchBareNumber: boolean },
): boolean {
  const { attemptIssues, blocker, matchBareNumber } = context;
  if ([blocker.storyId, ...(blocker.epicMembers ?? [])].some((id) => textMentionsName(request, id))) {
    return true;
  }
  const blockerIssues = [blocker.origin.issue, blocker.origin.epic].filter((url) => url !== '');
  if (blockerIssues.some((url) => attemptIssues.includes(url))) {
    return true;
  }
  if (!matchBareNumber) {
    return false;
  }
  return blockerIssues.some((url) => {
    const number = url.split('/').at(-1) ?? '';
    return number !== '' && new RegExp(`#${escapeRegExp(number)}\\b`).test(request);
  });
}

function mentionsAnyRepository(request: string, attemptRepos: readonly string[]): boolean {
  return attemptRepos.length > 0 || REPO_PATTERN.test(request);
}

function textMentionsName(text: string, name: string): boolean {
  if (name === '') {
    return false;
  }
  return new RegExp(`(?<![a-z0-9-])${escapeRegExp(name)}(?![a-z0-9-])`, 'i').test(text);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
