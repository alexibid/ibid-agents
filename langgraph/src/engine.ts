#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { registerAgentRunTools } from './agent-runs/agent-run-tools.js';
import { PostgresBacklogArchive } from './backlog/backlog-archive.js';
import { registerBacklogTools } from './backlog/backlog-tools.js';
import { agentRunFlowOf } from './agent-runs/setup.js';
import { buildCoachGraph } from './coach/graph.js';
import { CoachFlow, type CoachReport } from './coach-flow.js';
import { readConfiguration } from './configuration.js';
import { changeTrackerOf } from './checks/workspace-changes.js';
import { CheckpointActiveStories } from './flow/checkpoint-active-stories.js';
import { buildFlowGraph } from './flow/graph.js';
import { PostgresFlowJournal } from './journal/flow-journal.js';
import { PostgresHandoffArchive } from './handoff/handoff-archive.js';
import { registerHandoffTools } from './handoff/handoff-tools.js';
import { registerMemoryTools } from './memory/memory-tools.js';
import { PostgresNoteArchive } from './memory/note-archive.js';
import { Database } from './store/database.js';
import { StoryFlow, type StoryReport } from './story-flow.js';
import { SheetReader } from './sheets/sheet-reader.js';

const DEFAULT_COACH_WORKSPACE = '/Users/alexsantos/Projects/lemon-mart';
const database = new Database();

async function createFlows(): Promise<{ readonly storyFlow: StoryFlow; readonly coachFlow: CoachFlow }> {
  const { workspaceRoot, projectsDirectory, contractsDirectory, stateFile, coachStateFile } = readConfiguration();
  await mkdir(dirname(stateFile), { recursive: true });
  await mkdir(dirname(coachStateFile), { recursive: true });
  const sheets = new SheetReader(projectsDirectory);
  const changesOf = changeTrackerOf(workspaceRoot);
  const storyGraph = buildFlowGraph(
    { workspaceRoot, sheets, contractsDirectory, changesOf, activeStories: new CheckpointActiveStories(stateFile) },
    SqliteSaver.fromConnString(stateFile),
  );
  const storyFlow = new StoryFlow(storyGraph, new PostgresFlowJournal(database));
  const coachFlow = new CoachFlow(buildCoachGraph({ contractsDirectory }, SqliteSaver.fromConnString(coachStateFile)));
  return { storyFlow, coachFlow };
}

function answer(report: StoryReport | CoachReport) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(report, null, 2) }] };
}

function refusal(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

function registerTools(server: McpServer, storyFlow: StoryFlow, coachFlow: CoachFlow): void {
  server.registerTool(
    'start_story',
    {
      description:
        'Start a user story the user has approved. Returns the story id and the first thing the flow engine is waiting for.',
      inputSchema: {
        project: z.string().describe('The Nx project name, as in its project sheet'),
        title: z.string().describe('The user story in one sentence'),
        criteria: z.array(z.string()).min(1).describe('The acceptance criteria, one per entry'),
      },
    },
    async (story) => storyFlow.startStory(story).then(answer, refusal),
  );

  server.registerTool(
    'submit_plan',
    {
      description: 'Hand the specialist plan to the flow engine. A rejected plan comes back with the problems to fix.',
      inputSchema: {
        storyId: z.string(),
        files: z.array(z.string()).describe('Every workspace path to create or change'),
        conditions: z
          .array(z.enum(['ui', 'figures', 'workflows']))
          .describe('What the change touches; only the conditions the project sheet gives steps to count'),
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
      description: 'Read where a story stands: what the flow engine is waiting for, the remaining steps and the history.',
      inputSchema: { storyId: z.string() },
    },
    async ({ storyId }) => storyFlow.report(storyId).then(answer, refusal),
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
    'start_coaching',
    {
      description:
        'Start a pair-programming coaching session (separate from ibid-workspace stories). Returns the sessionId and the first step the flow engine is waiting for.',
      inputSchema: {
        goal: z.string().describe('What the student wants to learn or build in this session'),
        workspaceRoot: z
          .string()
          .default(DEFAULT_COACH_WORKSPACE)
          .describe('Absolute path of the coaching workspace (defaults to lemon-mart)'),
      },
    },
    async (goal) => coachFlow.startCoaching(goal).then(answer, refusal),
  );

  server.registerTool(
    'submit_coach_step',
    {
      description:
        'Hand the result of the current coaching step to the coach flow. Validates outside-in design, bite-sized Angular 22 lessons, and student code.',
      inputSchema: {
        sessionId: z.string(),
        handBack: z.record(z.string(), z.unknown()).describe('The payload expected by the current coaching step'),
      },
    },
    async ({ sessionId, handBack }) => coachFlow.submit(sessionId, handBack).then(answer, refusal),
  );

  server.registerTool(
    'coach_status',
    {
      description: 'Read where a coaching session stands: what step the flow engine is waiting for, validated lesson blocks, and history.',
      inputSchema: { sessionId: z.string() },
    },
    async ({ sessionId }) => coachFlow.report(sessionId).then(answer, refusal),
  );
}

const server = new McpServer({ name: 'ibid-langgraph', version: '0.1.0' });
const { storyFlow, coachFlow } = await createFlows();
registerTools(server, storyFlow, coachFlow);
registerMemoryTools(server, new PostgresNoteArchive(database));
registerHandoffTools(server, new PostgresHandoffArchive(database));
registerAgentRunTools(server, await agentRunFlowOf(database));
registerBacklogTools(server, new PostgresBacklogArchive(database));
await server.connect(new StdioServerTransport());
