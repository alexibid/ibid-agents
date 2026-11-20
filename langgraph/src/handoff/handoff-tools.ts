import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { HANDOFF_CLIENTS } from './handoff.js';
import type { HandoffArchive } from './handoff-archive.js';

function answer(found: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(found, null, 2) }] };
}

function refusal(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

export function registerHandoffTools(server: McpServer, archive: HandoffArchive): void {
  server.registerTool(
    'save_handoff',
    {
      description:
        'Save or update the active conversation baton so another interface (Claude Desktop, Claude Code, or Antigravity) can continue without re-explaining. Saving the same open topic in the same workspace updates the existing baton.',
      inputSchema: {
        workspace: z.string().describe('Workspace or project name, such as "ibid-workspace", "ibid-agents", or an Nx project'),
        client: z.enum(HANDOFF_CLIENTS).describe('The interface saving this baton'),
        topic: z.string().describe('Short title for the active conversation thread'),
        summary: z.string().describe('Concise state of the work so another interface can resume without the chat history'),
        decisions: z.array(z.string()).default([]).describe('Decisions already agreed on in this conversation'),
        nextAction: z.string().default('').describe('The exact next step to execute when resuming'),
        openQuestions: z.array(z.string()).default([]).describe('Questions still waiting for the user'),
        activeStoryId: z.string().default('').describe('Active storyId in ibid-langgraph, if any'),
        activeRunId: z.string().default('').describe('Active agent runId in ibid-langgraph, if any'),
        activeCoachId: z.string().default('').describe('Active coaching sessionId in ibid-langgraph, if any'),
      },
    },
    async (handoff) => archive.save(handoff).then(answer, refusal),
  );

  server.registerTool(
    'resume_handoff',
    {
      description:
        'Read the active baton to continue work started in another interface (Claude or Antigravity). Returns open handoffs plus any active stories and agent runs currently in progress.',
      inputSchema: {
        workspace: z
          .string()
          .default('')
          .describe('Optional workspace or project name to filter open handoffs. Leave empty to list all open handoffs.'),
      },
    },
    async ({ workspace }) => archive.active(workspace).then(answer, refusal),
  );

  server.registerTool(
    'close_handoff',
    {
      description: 'Close a handoff once its work is finished or superseded so it stops appearing on resume.',
      inputSchema: { handoffId: z.string() },
    },
    async ({ handoffId }) => archive.close(handoffId).then(answer, refusal),
  );
}
