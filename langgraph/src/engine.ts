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
import { GithubIssueSync } from './backlog/issue-sync.js';
import { changeTrackerOf, WorkspaceChanges } from './checks/workspace-changes.js';
import { CheckpointActiveStories } from './flow/checkpoint-active-stories.js';
import { buildFlowGraph } from './flow/graph.js';
import { registerStoryTools, type StoryWorkspace } from './flow/story-tools.js';
import { latestStoryThreads } from './store/story-threads.js';
import { flowCostSince } from './journal/flow-cost.js';
import { PostgresFlowJournal } from './journal/flow-journal.js';
import { PostgresHandoffArchive } from './handoff/handoff-archive.js';
import { registerHandoffTools } from './handoff/handoff-tools.js';
import { registerMemoryTools } from './memory/memory-tools.js';
import { PostgresNoteArchive } from './memory/note-archive.js';
import { Database } from './store/database.js';
import { StoryFlow } from './story-flow.js';
import { SheetReader } from './sheets/sheet-reader.js';

const DEFAULT_COACH_WORKSPACE = '/Users/alexsantos/Projects/lemon-mart';
const database = new Database();

interface Flows {
  readonly storyFlow: StoryFlow;
  readonly coachFlow: CoachFlow;
  readonly workspace: StoryWorkspace;
}

async function createFlows(): Promise<Flows> {
  const { workspaceRoot, projectsDirectory, contractsDirectory, stateFile, coachStateFile } = readConfiguration();
  await mkdir(dirname(stateFile), { recursive: true });
  await mkdir(dirname(coachStateFile), { recursive: true });
  const sheets = new SheetReader(projectsDirectory);
  const changesOf = changeTrackerOf(workspaceRoot);
  const storyGraph = buildFlowGraph(
    { workspaceRoot, sheets, contractsDirectory, changesOf, activeStories: new CheckpointActiveStories(stateFile) },
    SqliteSaver.fromConnString(stateFile),
  );
  const storyFlow = new StoryFlow(storyGraph, new PostgresFlowJournal(database), new GithubIssueSync());
  const coachFlow = new CoachFlow(buildCoachGraph({ contractsDirectory }, SqliteSaver.fromConnString(coachStateFile)));
  const workspace: StoryWorkspace = {
    storyIds: () => latestStoryThreads(stateFile).map(({ storyId }) => storyId),
    uncommittedAmong: async (files) => {
      const dirty = await new WorkspaceChanges(workspaceRoot).fingerprint();
      return files.filter((file) => file in dirty);
    },
  };
  return { storyFlow, coachFlow, workspace };
}

function answer(report: CoachReport) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(report, null, 2) }] };
}

function refusal(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

function registerCoachTools(server: McpServer, coachFlow: CoachFlow): void {
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
const { storyFlow, coachFlow, workspace } = await createFlows();
registerStoryTools(server, storyFlow, workspace);
registerCoachTools(server, coachFlow);
server.registerTool(
  'flow_cost',
  {
    description:
      'Measure what the stories started in the last days really ran: steps, failures, skipped repeats, test and screen steps, and steps done by agents, per story and on average.',
    inputSchema: { days: z.number().int().min(1).max(90).default(14) },
  },
  async ({ days }) =>
    flowCostSince(database, days).then(
      (cost) => ({ content: [{ type: 'text' as const, text: JSON.stringify(cost, null, 2) }] }),
      refusal,
    ),
);
registerMemoryTools(server, new PostgresNoteArchive(database));
registerHandoffTools(server, new PostgresHandoffArchive(database));
registerAgentRunTools(server, await agentRunFlowOf(database));
registerBacklogTools(server, new PostgresBacklogArchive(database));
await server.connect(new StdioServerTransport());
