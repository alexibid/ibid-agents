import { join } from 'node:path';
import type { ChangedFile } from '../checks/workspace-changes.js';
import { isOutsideWorkspace } from '../domain/sheet.js';

export interface CommitLine {
  readonly repository: string;
  readonly line: string;
}

const ROOT_REPOSITORY = '.';

export function handoverCommands(
  lines: readonly CommitLine[],
  changedFiles: readonly ChangedFile[],
  workspaceRoot: string,
): string[] {
  const ordered = [...lines].sort(submodulesFirst);
  const submodules = ordered
    .map(({ repository }) => repository)
    .filter((repository) => repository !== ROOT_REPOSITORY && !isOutsideWorkspace(repository));
  return [
    ...ordered.map((commitLine) => commandFor(commitLine, changedFiles, submodules, workspaceRoot)),
    ...sharedFileWarnings(changedFiles),
  ];
}

function submodulesFirst(first: CommitLine, second: CommitLine): number {
  const rank = (commitLine: CommitLine): number => (commitLine.repository === ROOT_REPOSITORY ? 1 : 0);
  return rank(first) - rank(second) || first.repository.localeCompare(second.repository);
}

function commandFor(
  { repository, line }: CommitLine,
  changedFiles: readonly ChangedFile[],
  submodules: readonly string[],
  workspaceRoot: string,
): string {
  const own = changedFiles
    .filter((changed) => changed.repository === repository && !changed.alreadyDirty)
    .map(({ file }) => pathInside(repository, file));
  const paths = repository === ROOT_REPOSITORY ? [...own, ...submodules] : own;
  const directory = repository === ROOT_REPOSITORY ? workspaceRoot : join(workspaceRoot, repository);
  const commit = `cd ${quoted(directory)} && git commit -m ${quoted(line)}`;
  if (paths.length === 0) {
    return `${nothingToStage(repository)} ${commit}`;
  }
  return `cd ${quoted(directory)} && git add -- ${paths.map(quoted).join(' ')} && git commit -m ${quoted(line)}`;
}

function nothingToStage(repository: string): string {
  return `Nothing in ${repository} can be staged for you: every file this story changed there already had uncommitted work. Stage the story's part by hand, then run:`;
}

function sharedFileWarnings(changedFiles: readonly ChangedFile[]): string[] {
  return changedFiles
    .filter(({ alreadyDirty }) => alreadyDirty)
    .map(
      ({ file }) =>
        `Left out of git add: ${file} already had uncommitted changes before this story, so it now mixes both. Stage the story's part by hand.`,
    );
}

function pathInside(repository: string, file: string): string {
  return repository === ROOT_REPOSITORY ? file : file.slice(repository.length + 1);
}

function quoted(value: string): string {
  return `'${value.replaceAll("'", String.raw`'\''`)}'`;
}
