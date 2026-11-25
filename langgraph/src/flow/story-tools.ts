import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { existsForSignedInUser } from '../agent-runs/github-link.js';
import { EpicProgressReader, type EpicProgress } from '../backlog/epic-progress.js';
import { setAntigravityTitle } from '../session/antigravity-title.js';
import type { StoryFlow, StoryReport } from '../story-flow.js';
import type { StoryOrigin } from './state.js';

export class IssueNotFoundError extends Error {
  constructor(url: string) {
    super(`${url} is not a GitHub issue the signed-in user can read. A story starts from an existing issue.`);
    this.name = 'IssueNotFoundError';
  }
}

type EpicReading = EpicProgress | 'no epic' | 'unreadable';

export interface StoryWorkspace {
  readonly storyIds: () => readonly string[];
  readonly uncommittedAmong: (files: readonly string[]) => Promise<string[]>;
}

const issueUrl = z.string().url().describe('The GitHub issue of the story, such as https://github.com/owner/repo/issues/38');
const epicUrl = z.string().default('').describe('The GitHub issue of the epic the story belongs to, or empty when it has none');
const SCREEN_CONDITIONS = ['ui', 'behaviour', 'figures', 'workflows'] as const;

export function registerStoryTools(
  server: McpServer,
  storyFlow: StoryFlow,
  workspace: StoryWorkspace,
  epics = new EpicProgressReader(),
): void {
  const answer = async (report: StoryReport) => text({ ...report, epic: await epicOf(report.origin, epics) });

  server.registerTool(
    'start_story',
    {
      description:
        'Start a user story the user has approved, from its GitHub issue. Returns the story id, its origin and the first thing the flow engine is waiting for.',
      inputSchema: {
        project: z.string().describe('The Nx project name, as in its project sheet'),
        title: z.string().describe('The user story in one sentence'),
        criteria: z.array(z.string()).min(1).describe('The acceptance criteria, one per entry'),
        issue: issueUrl,
        epic: epicUrl,
      },
    },
    async ({ issue, epic, ...story }) =>
      originChecked({ issue, epic })
        .then((origin) => storyFlow.startStory(story, origin))
        .then(answer, refusal),
  );

  server.registerTool(
    'submit_plan',
    {
      description: 'Hand the specialist plan to the flow engine. A rejected plan comes back with the problems to fix.',
      inputSchema: {
        storyId: z.string(),
        files: z.array(z.string()).describe('Every workspace path to create or change'),
        conditions: z
          .array(z.enum(SCREEN_CONDITIONS))
          .describe('What the change touches: ui for visual files, behaviour for component and route code, figures, workflows'),
        journey: z.string().default('').describe('The journey that covers the story, or empty'),
        reusedParts: z
          .array(z.string())
          .default([])
          .describe('The parts of the libraries the project sheet names under "Reuses" that were considered'),
        brief: z.string().default('').describe('What each later step needs to know: contracts, signatures, layers, edge cases'),
        followUps: z
          .array(z.string())
          .default([])
          .describe('Work outside this story worth doing later, such as a stale document; the project manager files it'),
      },
    },
    async ({ storyId, ...plan }) => storyFlow.submit(storyId, plan).then(answer, refusal),
  );

  server.registerTool(
    'submit_step',
    {
      description:
        'Hand the result of the current step to the flow engine, in the shape its instruction asked for. The flow engine verifies it, runs its own checks, and returns the next step or the exact failure.',
      inputSchema: {
        storyId: z.string(),
        handBack: z.record(z.string(), z.unknown()).describe('The evidence the current instruction asked for'),
      },
    },
    async ({ storyId, handBack }) => storyFlow.submit(storyId, handBack).then(answer, refusal),
  );

  server.registerTool(
    'story_status',
    {
      description:
        'Read where a story stands: its issue and epic with the epic progress, what the flow engine is waiting for, the remaining steps and the history.',
      inputSchema: { storyId: z.string() },
    },
    async ({ storyId }) => storyFlow.report(storyId).then(answer, refusal),
  );

  server.registerTool(
    'advance_to_commit',
    {
      description:
        'Only when the user asks to move on to the commit: run the tests, the review and the final verification. Before that, a story only builds and checks the change, and stops as ready-for-commit.',
      inputSchema: { storyId: z.string() },
    },
    async ({ storyId }) => storyFlow.advanceToCommit(storyId).then(answer, refusal),
  );

  server.registerTool(
    'hold_story',
    {
      description:
        'Pause a story before the commit steps: nothing that judges the change (rule checks, unit tests, validation, browser QA, UX, review, final verification) runs until the user asks to commit again with advance_to_commit.',
      inputSchema: { storyId: z.string() },
    },
    async ({ storyId }) => storyFlow.holdForCommit(storyId).then(answer, refusal),
  );

  server.registerTool(
    'resume_story',
    {
      description:
        'Take up a story that stopped as needs-user after the user decided how to go on. It continues at the step that stopped, with fresh attempts. Pass the user\'s decision, in their words, when an agent asked a question: it is added to the brief every later step reads.',
      inputSchema: {
        storyId: z.string(),
        decision: z.string().default('').describe('The user\'s answer to the questions the agent asked, in their words'),
      },
    },
    async ({ storyId, decision }) => storyFlow.resume(storyId, decision).then(answer, refusal),
  );

  server.registerTool(
    'link_story_issue',
    {
      description: 'Record the GitHub issue, and the epic, of a story that started without one.',
      inputSchema: { storyId: z.string(), issue: issueUrl, epic: epicUrl },
    },
    async ({ storyId, issue, epic }) =>
      originChecked({ issue, epic })
        .then((origin) => storyFlow.linkOrigin(storyId, origin))
        .then(answer, refusal),
  );

  server.registerTool(
    'confirm_commit',
    {
      description:
        'Once the user says the commit of a finished story is made: checks that none of its files is still uncommitted, closes its GitHub issue, and closes the epic when every sub-issue is done.',
      inputSchema: { storyId: z.string() },
    },
    async ({ storyId }) =>
      storyFlow
        .report(storyId)
        .then(async (report) => storyFlow.confirmCommit(storyId, await workspace.uncommittedAmong(report.files)))
        .then(answer, refusal),
  );

  server.registerTool(
    'sync_github',
    {
      description:
        'Bring every GitHub issue linked to a story in line with where the story really stands: status labels, the status comment, closing committed stories and complete epics. Returns one line per story and whether everything is up to date.',
      inputSchema: {},
    },
    async () => syncedStories(storyFlow, workspace).then(text, refusal),
  );

  server.registerTool(
    'abandon_story',
    {
      description:
        'Close a story the user decided not to finish, so it stops holding its files and no longer counts as in progress. Its changes stay in the tree.',
      inputSchema: { storyId: z.string() },
    },
    async ({ storyId }) => storyFlow.abandon(storyId).then(answer, refusal),
  );

  server.registerTool(
    'set_conversation_title',
    {
      description:
        'Antigravity only: rename the current conversation in plain words, in the user\'s language, with no numbers or #, such as "Livro no desktop › Abrir e fechar suave". The id is the folder name under ~/.gemini/antigravity/brain/ that holds this conversation.',
      inputSchema: { conversationId: z.string(), title: z.string().min(1).max(80) },
    },
    async ({ conversationId, title }) =>
      setAntigravityTitle(conversationId, title).then((kept) => text({ title: kept }), refusal),
  );
}

async function syncedStories(storyFlow: StoryFlow, workspace: StoryWorkspace) {
  const reports = await Promise.all(workspace.storyIds().map((storyId) => storyFlow.report(storyId)));
  const stories = [];
  for (const report of storiesToSync(reports)) {
    const synced = await storyFlow.resync(report.storyId, await workspace.uncommittedAmong(report.files));
    stories.push({ storyId: report.storyId, issue: synced.origin.issue, status: synced.status, github: synced.github });
  }
  const failed = stories.filter(({ github }) => github.state === 'failed');
  return { allUpToDate: failed.length === 0, on: new Date().toISOString(), stories };
}

export function storiesToSync(reports: readonly StoryReport[]): StoryReport[] {
  const byIssue = new Map<string, StoryReport>();
  for (const report of reports.filter(({ origin }) => origin.issue !== '')) {
    const kept = byIssue.get(report.origin.issue);
    if (kept === undefined || (kept.status === 'abandoned' && report.status !== 'abandoned')) {
      byIssue.set(report.origin.issue, report);
    }
  }
  return [...byIssue.values()];
}

async function originChecked(origin: StoryOrigin): Promise<StoryOrigin> {
  for (const url of [origin.issue, origin.epic].filter((link) => link !== '')) {
    if (!(await existsForSignedInUser(new URL(url)))) {
      throw new IssueNotFoundError(url);
    }
  }
  return origin;
}

async function epicOf(origin: StoryOrigin, epics: EpicProgressReader): Promise<EpicReading> {
  if (origin.epic === '') {
    return 'no epic';
  }
  return epics.progressOf(origin.epic).catch(() => 'unreadable' as const);
}

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function refusal(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}
