import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NoteArchive } from './note-archive.js';
import { NOTE_KINDS, NOTE_STATUSES } from './note.js';

const PROJECTS = z
  .array(z.string())
  .default([])
  .describe('Project names to look in. Empty looks in every project. Use "workspace" for what belongs to none.');

function answer(found: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(found, null, 2) }] };
}

function refusal(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

export function registerMemoryTools(server: McpServer, archive: NoteArchive): void {
  server.registerTool(
    'remember_note',
    {
      description:
        'Keep an idea, a plan, a decision or the conclusion of a piece of research, so it is not worked out twice. Saving the same title again for the same project and kind replaces the earlier text.',
      inputSchema: {
        kind: z.enum(NOTE_KINDS),
        project: z.string().describe('The project it belongs to, or "workspace"'),
        title: z.string().describe('A short name a later search would use'),
        body: z.string().describe('What was concluded and why, complete enough to act on without the conversation'),
        keywords: z.array(z.string()).default([]).describe('Other words someone might search by, in Portuguese and English'),
        sources: z.array(z.string()).default([]).describe('Links or file paths the conclusion rests on'),
      },
    },
    async (newNote) => archive.remember(newNote).then(answer, refusal),
  );

  server.registerTool(
    'recall_notes',
    {
      description:
        'Search what was already thought about, before researching or planning anything. Returns the most relevant notes, best first.',
      inputSchema: { text: z.string().describe('The subject, in the words of the request'), projects: PROJECTS },
    },
    async (question) => archive.recall(question).then(answer, refusal),
  );

  server.registerTool(
    'list_open_notes',
    {
      description: 'List the ideas and plans that are still to be carried out.',
      inputSchema: { projects: PROJECTS },
    },
    async ({ projects }) => archive.stillOpen(projects).then(answer, refusal),
  );

  server.registerTool(
    'set_note_status',
    {
      description: 'Mark a note as done or dropped, or open it again.',
      inputSchema: { noteId: z.string(), status: z.enum(NOTE_STATUSES) },
    },
    async (change) => archive.changeStatus(change).then(answer, refusal),
  );
}
