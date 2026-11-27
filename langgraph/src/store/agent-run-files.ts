import { isAbsolute, relative } from 'node:path';
import { latestThreads, type ChannelValues, type LatestThread } from './story-threads.js';

export interface AgentRunFiles {
  readonly runId: string;
  readonly files: readonly string[];
  readonly updatedOn: Date;
}

const CHANGE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  change: ['changedFiles'],
  resolve: ['resolvedFiles'],
  fix: ['changedFiles'],
  write: ['content'],
  images: ['images'],
  'prepare-files': ['files'],
};

export function latestAgentRunFiles(stateFile: string, workspaceRoot: string): AgentRunFiles[] {
  return latestThreads(stateFile)
    .map((thread) => agentRunFilesOf(thread, workspaceRoot))
    .filter(({ files }) => files.length > 0);
}

function agentRunFilesOf({ threadId, values, updatedOn }: LatestThread, workspaceRoot: string): AgentRunFiles {
  const results = recordOf(values['results']);
  const files = [...new Set(Object.entries(CHANGE_FIELDS).flatMap(([step, fields]) => filesFromStep(results[step], fields, workspaceRoot)))];
  return { runId: threadId, files, updatedOn };
}

function filesFromStep(stepValue: unknown, fields: readonly string[], workspaceRoot: string): string[] {
  const step = recordOf(stepValue);
  return fields.flatMap((field) => textsOf(step[field])).map((file) => workspacePath(file, workspaceRoot));
}

function workspacePath(file: string, workspaceRoot: string): string {
  return workspaceRoot !== '' && isAbsolute(file) ? relative(workspaceRoot, file) : file;
}

function recordOf(value: unknown): ChannelValues {
  return typeof value === 'object' && value !== null ? (value as ChannelValues) : {};
}

function textsOf(value: unknown): string[] {
  if (typeof value === 'string' && value.trim() !== '') {
    return [value];
  }
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '') : [];
}
