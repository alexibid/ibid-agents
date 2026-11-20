import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { BacklogArchive } from './backlog-archive.js';

function answer(found: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(found, null, 2) }] };
}

function refusal(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

export function registerBacklogTools(server: McpServer, archive: BacklogArchive): void {
  server.registerTool(
    'read_backlog',
    {
      description:
        'Read the backlog the flow engine keeps: every epic with its stories and tasks, the exact title and body of each issue, its GitHub type and labels, and its link once published. Drafts wait for the user to approve them.',
      inputSchema: {
        project: z.string().default('').describe('Only the epics of this project. Empty reads every project.'),
        epicId: z.string().default('').describe('Only this epic. Empty reads every epic.'),
      },
    },
    async ({ project, epicId }) =>
      archive
        .epics(project)
        .then((epics) => (epicId === '' ? epics : epics.filter((epic) => epic.id === epicId)))
        .then(answer, refusal),
  );
}
