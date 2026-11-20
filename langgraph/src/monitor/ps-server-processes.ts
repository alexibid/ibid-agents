import { execFile } from 'node:child_process';
import { basename } from 'node:path';
import { promisify } from 'node:util';
import type { ProcessKind, RunningProcess, ServerProcesses } from './engine-servers.js';

const run = promisify(execFile);
const PROCESS_LINE = /^\s*(\d+)\s+(\d+)\s+(\w{3} \w{3}\s+\d+ [\d:]+ \d{4})\s+(.*)$/;

export interface ServerScripts {
  readonly relay: string;
  readonly engine: string;
}

export class PsServerProcesses implements ServerProcesses {
  constructor(private readonly scripts: ServerScripts) {}

  async running(): Promise<readonly RunningProcess[]> {
    const { stdout } = await run('ps', ['-axo', 'pid=,ppid=,lstart=,command='], { env: { ...process.env, LC_ALL: 'C' } });
    const found = stdout.split('\n').flatMap((line) => this.processIn(line));
    return Promise.all(found.map(async (entry) => ({ ...entry, folder: entry.kind === 'relay' ? await folderOf(entry.parent) : '' })));
  }

  stop(pid: number): void {
    process.kill(pid, 'SIGTERM');
  }

  private processIn(line: string): Omit<RunningProcess, 'folder'>[] {
    const match = PROCESS_LINE.exec(line);
    const kind = match === null ? undefined : this.kindOf(match[4] ?? '');
    if (match === null || kind === undefined) {
      return [];
    }
    return [{ pid: Number(match[1]), parent: Number(match[2]), kind, startedOn: new Date(match[3] ?? '') }];
  }

  private kindOf(command: string): ProcessKind | undefined {
    const [program, script, ...rest] = command.trim().split(/\s+/);
    if (basename(program ?? '') !== 'node' || rest.length > 0) {
      return undefined;
    }
    return script === this.scripts.relay ? 'relay' : script === this.scripts.engine ? 'engine' : undefined;
  }
}

async function folderOf(pid: number): Promise<string> {
  try {
    const { stdout } = await run('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']);
    return stdout.split('\n').find((line) => line.startsWith('n'))?.slice(1) ?? '';
  } catch {
    return '';
  }
}
