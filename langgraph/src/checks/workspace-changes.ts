import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readCommand } from './shell.js';

export interface DirtyFile {
  readonly repository: string;
  readonly file: string;
}

export interface ChangedFile extends DirtyFile {
  readonly alreadyDirty: boolean;
}

export type Fingerprint = Readonly<Record<string, string>>;

const ROOT_REPOSITORY = '.';
const DELETED = 'deleted';
const SUBMODULE_PATH = /^\s*path\s*=\s*(.+)$/gm;

export class WorkspaceChanges {
  constructor(private readonly root: string) {}

  async fingerprint(): Promise<Fingerprint> {
    const dirtyFiles = await this.dirtyFiles();
    const entries = await Promise.all(
      dirtyFiles.map(async ({ file }) => [file, await this.hashOf(file)] as const),
    );
    return Object.fromEntries(entries);
  }

  async changedSince(baseline: Fingerprint): Promise<ChangedFile[]> {
    const dirtyFiles = await this.dirtyFiles();
    const current = await this.fingerprint();
    return dirtyFiles
      .filter(({ file }) => current[file] !== baseline[file])
      .map((dirtyFile) => ({ ...dirtyFile, alreadyDirty: dirtyFile.file in baseline }));
  }

  private async dirtyFiles(): Promise<DirtyFile[]> {
    const repositories = [ROOT_REPOSITORY, ...(await this.submodulePaths())];
    const perRepository = await Promise.all(repositories.map((repository) => this.dirtyFilesOf(repository)));
    return perRepository.flat().filter(({ file }) => !repositories.includes(file));
  }

  private async dirtyFilesOf(repository: string): Promise<DirtyFile[]> {
    const status = await readCommand('git status --porcelain --untracked-files=all', join(this.root, repository));
    return status
      .split('\n')
      .filter((line) => line.length > 3)
      .map((line) => ({ repository, file: workspacePath(repository, pathOfStatusLine(line)) }));
  }

  private async submodulePaths(): Promise<string[]> {
    const gitmodules = await readFile(join(this.root, '.gitmodules'), 'utf8').catch(() => '');
    return [...gitmodules.matchAll(SUBMODULE_PATH)].flatMap((match) =>
      match[1] === undefined ? [] : [match[1].trim()],
    );
  }

  private async hashOf(file: string): Promise<string> {
    const content = await readFile(join(this.root, file)).catch(() => DELETED);
    return content === DELETED ? DELETED : createHash('sha1').update(content).digest('hex');
  }
}

function pathOfStatusLine(line: string): string {
  const path = line.slice(3);
  const renamedTo = path.split(' -> ')[1];
  return (renamedTo ?? path).replace(/^"|"$/g, '').replace(/\/$/, '');
}

function workspacePath(repository: string, file: string): string {
  return repository === ROOT_REPOSITORY ? file : `${repository}/${file}`;
}
