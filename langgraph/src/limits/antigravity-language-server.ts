import { execFile } from 'node:child_process';
import { Agent, request } from 'node:https';
import { promisify } from 'node:util';
import { languageServerProcessIdsIn, sessionKeyIn } from './antigravity-process.js';

export class LanguageServerUnreachableError extends Error {
  constructor(reason: string) {
    super(`Antigravity could not be reached: ${reason}`);
    this.name = 'LanguageServerUnreachableError';
  }
}

export type AnswerReading<T> = (answer: unknown) => T | undefined;

const run = promisify(execFile);
const SERVICE_PATH = '/exa.language_server_pb.LanguageServerService/';
const TRUSTS_LOCAL_CERTIFICATE = new Agent({ rejectUnauthorized: false });
const ANSWER_TIMEOUT_MS = 4000;
const NO_ANSWER = '';

export async function isAntigravityRunning(): Promise<boolean> {
  return (await runningLanguageServers()).length > 0;
}

export async function askAntigravity<T>(method: string, body: unknown, read: AnswerReading<T>): Promise<T> {
  const reasons: string[] = [];
  for (const processId of await runningLanguageServers()) {
    const answer = await answerOfServer(processId, method, JSON.stringify(body), read).catch((error: unknown) => {
      reasons.push(error instanceof Error ? error.message : String(error));
      return undefined;
    });
    if (answer !== undefined) {
      return answer;
    }
  }
  throw new LanguageServerUnreachableError(reasons.length === 0 ? 'no language server is running' : reasons.join('; '));
}

async function runningLanguageServers(): Promise<string[]> {
  const { stdout } = await run('ps', ['-axwwo', 'pid=,command=']);
  return languageServerProcessIdsIn(stdout);
}

async function answerOfServer<T>(processId: string, method: string, body: string, read: AnswerReading<T>): Promise<T> {
  const sessionKey = await sessionKeyOf(processId);
  if (sessionKey === undefined) {
    throw new Error(`language server ${processId} carries no session key`);
  }
  for (const port of await listeningPortsOf(processId)) {
    const answer = read(parsed(await ask(port, sessionKey, method, body)));
    if (answer !== undefined) {
      return answer;
    }
  }
  throw new Error(`language server ${processId} gave no answer to ${method} on any port`);
}

async function sessionKeyOf(processId: string): Promise<string | undefined> {
  const { stdout } = await run('ps', ['eww', '-o', 'command=', '-p', processId]).catch(() => ({ stdout: '' }));
  return sessionKeyIn(stdout);
}

async function listeningPortsOf(processId: string): Promise<number[]> {
  const listed = await run('lsof', ['-nP', '-a', '-p', processId, '-iTCP', '-sTCP:LISTEN', '-Fn']).catch(() => ({ stdout: '' }));
  return [...listed.stdout.matchAll(/^n127\.0\.0\.1:(\d+)$/gm)].map((match) => Number(match[1]));
}

function ask(port: number, sessionKey: string, method: string, body: string): Promise<string> {
  return new Promise((resolve) => {
    const call = request(
      {
        host: '127.0.0.1',
        port,
        path: `${SERVICE_PATH}${method}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Connect-Protocol-Version': '1', 'X-Codeium-Csrf-Token': sessionKey },
        agent: TRUSTS_LOCAL_CERTIFICATE,
        timeout: ANSWER_TIMEOUT_MS,
      },
      (response) => {
        let text = '';
        response.on('data', (chunk: Buffer) => (text += chunk.toString()));
        response.on('end', () => resolve(response.statusCode === 200 ? text : NO_ANSWER));
      },
    );
    call.on('timeout', () => call.destroy());
    call.on('error', () => resolve(NO_ANSWER));
    call.end(body);
  });
}

function parsed(text: string): unknown {
  if (text === NO_ANSWER) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
