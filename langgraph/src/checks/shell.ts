import { spawn } from 'node:child_process';

export interface CommandOutcome {
  readonly succeeded: boolean;
  readonly outputTail: string;
}

const TAIL_LINES = 40;
const TEN_MINUTES = 600_000;

export function runCommand(command: string, workingDirectory: string, input = ''): Promise<CommandOutcome> {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd: workingDirectory, shell: true, timeout: TEN_MINUTES });
    const chunks: string[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
    child.on('error', (error) => resolve({ succeeded: false, outputTail: error.message }));
    child.on('close', (exitCode) => resolve({ succeeded: exitCode === 0, outputTail: tailOf(chunks.join('')) }));
    child.stdin.end(input);
  });
}

export async function readCommand(command: string, workingDirectory: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd: workingDirectory, shell: true });
    const chunks: string[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
    child.on('error', reject);
    child.on('close', (exitCode) =>
      exitCode === 0 ? resolve(chunks.join('')) : reject(new Error(`"${command}" exited with ${exitCode}`)),
    );
  });
}

function tailOf(output: string): string {
  return output.trimEnd().split('\n').slice(-TAIL_LINES).join('\n');
}
