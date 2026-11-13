import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import type { Tool } from './prompt-record.js';

export interface TranscriptFile {
  readonly path: string;
  readonly tool: Tool;
  readonly conversationId: string;
  readonly sizeBytes: number;
  readonly modifiedOn: Date;
}

const CLAUDE_PROJECTS = join(homedir(), '.claude', 'projects');
const ANTIGRAVITY_HOMES = ['antigravity', 'antigravity-ide', 'antigravity-cli'].map((name) => join(homedir(), '.gemini', name, 'brain'));
const ANTIGRAVITY_TRANSCRIPT = join('.system_generated', 'logs', 'transcript.jsonl');
const DAY_MS = 86_400_000;

export async function transcriptsChangedWithin(days: number): Promise<TranscriptFile[]> {
  const oldest = Date.now() - days * DAY_MS;
  const found = await Promise.all([claudeTranscripts(), ...ANTIGRAVITY_HOMES.map(antigravityTranscripts)]);
  return found.flat().filter((file) => file.modifiedOn.getTime() >= oldest);
}

async function claudeTranscripts(): Promise<TranscriptFile[]> {
  const projects = await directoriesIn(CLAUDE_PROJECTS);
  const perProject = await Promise.all(
    projects.map(async (project) => {
      const names = (await namesIn(project)).filter((name) => name.endsWith('.jsonl'));
      return described(names.map((name) => join(project, name)), 'claude', (path) => basename(path, '.jsonl'));
    }),
  );
  return perProject.flat();
}

async function antigravityTranscripts(brain: string): Promise<TranscriptFile[]> {
  const conversations = await directoriesIn(brain);
  const paths = conversations.map((conversation) => join(conversation, ANTIGRAVITY_TRANSCRIPT));
  return described(paths, 'antigravity', (path) => basename(dirname(dirname(dirname(path)))));
}

async function described(paths: readonly string[], tool: Tool, conversationIdOf: (path: string) => string): Promise<TranscriptFile[]> {
  const files = await Promise.all(
    paths.map(async (path) => {
      const details = await stat(path).catch(() => undefined);
      return details?.isFile() === true
        ? [{ path, tool, conversationId: conversationIdOf(path), sizeBytes: details.size, modifiedOn: details.mtime }]
        : [];
    }),
  );
  return files.flat();
}

async function directoriesIn(parent: string): Promise<string[]> {
  const entries = await readdir(parent, { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory()).map((entry) => join(parent, entry.name));
}

async function namesIn(directory: string): Promise<string[]> {
  return readdir(directory).catch(() => []);
}
