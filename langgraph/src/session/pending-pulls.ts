import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const FETCH_TIMEOUT_MS = 8000;

export interface PendingPull {
  readonly directory: string;
  readonly commitsBehind: number;
}

export interface RepositoryReader {
  submodulesOf(root: string): Promise<readonly string[]>;
  commitsBehind(directory: string): Promise<number>;
}

export class GitRepositoryReader implements RepositoryReader {
  async submodulesOf(root: string): Promise<readonly string[]> {
    const listing = await this.git(root, 'config', '-f', '.gitmodules', '--get-regexp', '^submodule\\..*\\.path$');
    return listing
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => `${root}/${line.split(' ')[1]}`);
  }

  async commitsBehind(directory: string): Promise<number> {
    await this.git(directory, 'fetch', '--quiet');
    const count = await this.git(directory, 'rev-list', '--count', 'HEAD..@{upstream}');
    return Number.parseInt(count, 10) || 0;
  }

  private async git(directory: string, ...args: readonly string[]): Promise<string> {
    try {
      const { stdout } = await run('git', args, { cwd: directory, timeout: FETCH_TIMEOUT_MS });
      return stdout.trim();
    } catch {
      return '';
    }
  }
}

export async function pendingPulls(
  roots: readonly string[],
  reader: RepositoryReader,
): Promise<readonly PendingPull[]> {
  const nested = await Promise.all(roots.map(async (root) => [root, ...(await reader.submodulesOf(root))]));
  const directories = [...new Set(nested.flat())];
  const behind = await Promise.all(
    directories.map(async (directory) => ({ directory, commitsBehind: await reader.commitsBehind(directory) })),
  );
  return behind.filter((repository) => repository.commitsBehind > 0);
}

export function pendingPullNotice(pulls: readonly PendingPull[]): string {
  if (pulls.length === 0) return '';
  const lines = pulls.map(
    ({ directory, commitsBehind }) => `- \`${directory}\`: ${commitsBehind} commit(s) behind. Run: \`git -C ${directory} pull --ff-only\``,
  );
  return [
    'PENDING PULLS. These repositories are behind their remote:',
    ...lines,
    '',
    'Before doing anything else, tell the user which repositories are behind, ask them to pull,',
    'and wait for their confirmation. Do not read, plan or change code until they confirm.',
  ].join('\n');
}
