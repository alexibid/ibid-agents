import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { StoryOrigin } from '../flow/state.js';
import { isObject, numberIn, objectIn, textIn } from '../usage/json-reading.js';
import {
  ALL_STATUS_LABELS,
  EPIC_IN_PROGRESS,
  STATUS_MARKER,
  labelOf,
  statusCommentOf,
  type IssueStage,
  type StageLabel,
} from './issue-stage.js';

export type Gh = (args: readonly string[]) => Promise<string>;

export interface GithubSync {
  readonly state: 'updated' | 'failed' | 'not linked' | 'not checked';
  readonly on: string;
  readonly detail: string;
}

export interface IssueSync {
  show(origin: StoryOrigin, stage: IssueStage): Promise<GithubSync>;
  closeBuilt(origin: StoryOrigin, stage: 'ready-for-commit' | 'awaiting-commit'): Promise<GithubSync>;
  closeDone(origin: StoryOrigin): Promise<GithubSync>;
}

interface IssueAddress {
  readonly repository: string;
  readonly number: string;
}

const run = promisify(execFile);
const GH_TIMEOUT_MS = 15000;
const ISSUE_URL = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)\/?$/;

export const NOT_SYNCING: IssueSync = {
  show: async () => notLinked(),
  closeBuilt: async () => notLinked(),
  closeDone: async () => notLinked(),
};

export class GithubIssueSync implements IssueSync {
  private readonly preparedRepositories = new Set<string>();

  constructor(
    private readonly gh: Gh = ghCli,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async show(origin: StoryOrigin, stage: IssueStage): Promise<GithubSync> {
    return this.synced(origin, async (story) => {
      await this.labelStage(story, stage);
      await this.writeStatusComment(story, stage);
      const epic = addressOf(origin.epic);
      if (epic !== undefined && stage !== 'stopped') {
        await this.addLabel(epic, EPIC_IN_PROGRESS);
      }
      return `issue #${story.number} shows "${stage}"`;
    });
  }

  async closeBuilt(origin: StoryOrigin, stage: 'ready-for-commit' | 'awaiting-commit'): Promise<GithubSync> {
    return this.synced(origin, async (story) => {
      await this.labelStage(story, stage);
      await this.writeStatusComment(story, stage);
      await this.gh(['issue', 'close', story.number, '-R', story.repository, '--reason', 'completed']);
      await this.closeSubIssues(story);
      const epic = addressOf(origin.epic);
      if (epic !== undefined) {
        await this.addLabel(epic, EPIC_IN_PROGRESS);
      }
      return `issue #${story.number} closed (${stage})`;
    });
  }

  async closeDone(origin: StoryOrigin): Promise<GithubSync> {
    return this.synced(origin, async (story) => {
      await this.labelStage(story, 'done');
      await this.writeStatusComment(story, 'done');
      await this.gh(['issue', 'close', story.number, '-R', story.repository, '--reason', 'completed']);
      await this.closeSubIssues(story);
      const epic = addressOf(origin.epic);
      const epicClosed = epic !== undefined && (await this.closeEpicWhenComplete(epic));
      return `issue #${story.number} closed${epicClosed ? `; epic #${epic?.number} closed, every sub-issue is done` : ''}`;
    });
  }

  private async synced(origin: StoryOrigin, work: (story: IssueAddress) => Promise<string>): Promise<GithubSync> {
    const story = addressOf(origin.issue);
    if (story === undefined) {
      return notLinked();
    }
    try {
      return { state: 'updated', on: this.now().toISOString(), detail: await work(story) };
    } catch (error) {
      return { state: 'failed', on: this.now().toISOString(), detail: error instanceof Error ? error.message : String(error) };
    }
  }

  private async labelStage(issue: IssueAddress, stage: IssueStage): Promise<void> {
    await this.prepareLabels(issue.repository);
    const wanted = labelOf(stage);
    const current = labelsIn(JSON.parse(await this.gh(['api', apiPathOf(issue)])));
    const stale = ALL_STATUS_LABELS.map(({ name }) => name).filter((name) => current.includes(name) && name !== nameOf(wanted));
    const edits = [
      ...(wanted !== 'none' && !current.includes(wanted.name) ? ['--add-label', wanted.name] : []),
      ...(stale.length > 0 ? ['--remove-label', stale.join(',')] : []),
    ];
    if (edits.length > 0) {
      await this.gh(['issue', 'edit', issue.number, '-R', issue.repository, ...edits]);
    }
  }

  private async addLabel(issue: IssueAddress, label: StageLabel): Promise<void> {
    await this.prepareLabels(issue.repository);
    await this.gh(['issue', 'edit', issue.number, '-R', issue.repository, '--add-label', label.name]);
  }

  private async writeStatusComment(issue: IssueAddress, stage: IssueStage): Promise<void> {
    const body = statusCommentOf(stage, this.now());
    const comments: unknown = JSON.parse(await this.gh(['api', `${apiPathOf(issue)}/comments?per_page=100`]));
    const existing = (Array.isArray(comments) ? comments : []).find(
      (comment: unknown) => isObject(comment) && textIn(comment, 'body').includes(STATUS_MARKER),
    );
    if (isObject(existing)) {
      const path = `repos/${issue.repository}/issues/comments/${numberIn(existing, 'id')}`;
      await this.gh(['api', '-X', 'PATCH', path, '-f', `body=${body}`]);
      return;
    }
    await this.gh(['issue', 'comment', issue.number, '-R', issue.repository, '--body', body]);
  }

  private async closeSubIssues(story: IssueAddress): Promise<void> {
    const raw = await this.gh(['api', `${apiPathOf(story)}/sub_issues?per_page=100`]);
    if (raw.trim() === '') {
      return;
    }
    const items: unknown = JSON.parse(raw);
    for (const sub of Array.isArray(items) ? items : []) {
      if (!isObject(sub) || textIn(sub, 'state').toLowerCase() !== 'open') {
        continue;
      }
      const subNumber = numberIn(sub, 'number');
      if (subNumber > 0) {
        await this.gh(['issue', 'close', String(subNumber), '-R', story.repository, '--reason', 'completed']);
      }
    }
  }

  private async closeEpicWhenComplete(epic: IssueAddress): Promise<boolean> {
    const summary = objectIn(asObject(JSON.parse(await this.gh(['api', apiPathOf(epic)]))), 'sub_issues_summary');
    const total = numberIn(summary, 'total');
    if (total === 0 || numberIn(summary, 'completed') < total) {
      return false;
    }
    await this.gh(['issue', 'close', epic.number, '-R', epic.repository, '--reason', 'completed']);
    return true;
  }

  private async prepareLabels(repository: string): Promise<void> {
    if (this.preparedRepositories.has(repository)) {
      return;
    }
    for (const label of [...ALL_STATUS_LABELS, EPIC_IN_PROGRESS]) {
      await this.gh(['label', 'create', label.name, '-R', repository, '--color', label.color, '--description', label.description, '--force']);
    }
    this.preparedRepositories.add(repository);
  }
}

export function addressOf(url: string): IssueAddress | undefined {
  const match = ISSUE_URL.exec(url);
  return match?.[1] === undefined || match[2] === undefined ? undefined : { repository: match[1], number: match[2] };
}

function apiPathOf({ repository, number }: IssueAddress): string {
  return `repos/${repository}/issues/${number}`;
}

function labelsIn(issue: unknown): string[] {
  const labels = isObject(issue) ? issue['labels'] : [];
  return (Array.isArray(labels) ? labels : []).map((label: unknown) => (isObject(label) ? textIn(label, 'name') : ''));
}

function nameOf(label: StageLabel | 'none'): string {
  return label === 'none' ? '' : label.name;
}

function asObject(value: unknown) {
  return isObject(value) ? value : {};
}

function notLinked(): GithubSync {
  return { state: 'not linked', on: new Date().toISOString(), detail: 'the story has no GitHub issue' };
}

async function ghCli(args: readonly string[]): Promise<string> {
  const { stdout } = await run('gh', [...args], { timeout: GH_TIMEOUT_MS });
  return stdout;
}
