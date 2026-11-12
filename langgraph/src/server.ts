#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readConfiguration } from './configuration.js';
import { buildFlowGraph } from './flow/graph.js';
import { StoryFlow, type StoryReport } from './story-flow.js';
import { SheetReader } from './sheets/sheet-reader.js';

async function createStoryFlow(): Promise<StoryFlow> {
  const { workspaceRoot, projectsDirectory, contractsDirectory, stateFile } = readConfiguration();
  await mkdir(dirname(stateFile), { recursive: true });
  const sheets = new SheetReader(projectsDirectory);
  return new StoryFlow(buildFlowGraph({ workspaceRoot, sheets, contractsDirectory }, SqliteSaver.fromConnString(stateFile)));
}

function answer(report: StoryReport) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(report, null, 2) }] };
}

function refusal(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

function registerTools(server: McpServer, storyFlow: StoryFlow): void {
  server.registerTool(
    'start_story',
    {
      description:
        'Start a user story the user has approved. Returns the story id and the first thing LangGraph is waiting for.',
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
      description: 'Hand the specialist plan to LangGraph. A rejected plan comes back with the problems to fix.',
      inputSchema: {
        storyId: z.string(),
        files: z.array(z.string()).describe('Every workspace path to create or change'),
        conditions: z.array(z.enum(['ui', 'figures', 'workflows'])).describe('What the change touches'),
        journey: z.string().default('').describe('The journey that covers the story, or empty'),
        reusedParts: z.array(z.string()).default([]).describe('The ibid-ui parts considered for reuse'),
        brief: z.string().default('').describe('What each later step needs to know: contracts, signatures, layers, edge cases'),
      },
    },
    async ({ storyId, ...plan }) => storyFlow.submit(storyId, plan).then(answer, refusal),
  );

  server.registerTool(
    'submit_step',
    {
      description:
        'Hand the result of the current step to LangGraph, in the shape its instruction asked for. LangGraph verifies it, runs its own checks, and returns the next step or the exact failure.',
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
      description: 'Read where a story stands: what LangGraph is waiting for, the remaining steps and the history.',
      inputSchema: { storyId: z.string() },
    },
    async ({ storyId }) => storyFlow.report(storyId).then(answer, refusal),
  );
}

const server = new McpServer({ name: 'ibid-langgraph', version: '0.1.0' });
registerTools(server, await createStoryFlow());
await server.connect(new StdioServerTransport());
