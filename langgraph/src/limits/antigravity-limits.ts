import { execFile } from 'node:child_process';
import { Agent, request } from 'node:https';
import { promisify } from 'node:util';
import { languageServerProcessIdsIn, sessionKeyIn } from './antigravity-process.js';
import { samplesOfAntigravitySummary, type LimitSample } from './limit-sample.js';

const run = promisify(execFile);
const SUMMARY_PATH = '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary';
const REQUEST_BODY = JSON.stringify({ metadata: { ideName: 'antigravity', extensionName: 'antigravity', locale: 'en' } });
const TRUSTS_LOCAL_CERTIFICATE = new Agent({ rejectUnauthorized: false });
const ANSWER_TIMEOUT_MS = 4000;
const NO_ANSWER = '';

export class AntigravityLimitsUnreadableError extends Error {
  constructor(reason: string) {
    super(`Antigravity limits could not be read: ${reason}`);
    this.name = 'AntigravityLimitsUnreadableError';
  }
}

export async function readAntigravityLimits(): Promise<LimitSample[]> {
  const reasons: string[] = [];
  for (const processId of await runningLanguageServers()) {
    const samples = await samplesOfServer(processId).catch((error: unknown) => {
      reasons.push(error instanceof Error ? error.message : String(error));
      return [];
    });
    if (samples.length > 0) {
      return samples;
    }
  }
  if (reasons.length > 0) {
    throw new AntigravityLimitsUnreadableError(reasons.join('; '));
  }
  return [];
}

async function runningLanguageServers(): Promise<string[]> {
  const { stdout } = await run('ps', ['-axwwo', 'pid=,command=']);
  return languageServerProcessIdsIn(stdout);
}

async function samplesOfServer(processId: string): Promise<LimitSample[]> {
  const sessionKey = await sessionKeyOf(processId);
  if (sessionKey === undefined) {
    throw new Error(`language server ${processId} carries no session key`);
  }
  for (const port of await listeningPortsOf(processId)) {
    const samples = samplesOfAntigravitySummary(parsed(await ask(port, sessionKey)));
    if (samples.length > 0) {
      return samples;
    }
  }
  throw new Error(`language server ${processId} gave no quota on any port`);
}

async function sessionKeyOf(processId: string): Promise<string | undefined> {
  const { stdout } = await run('ps', ['eww', '-o', 'command=', '-p', processId]).catch(() => ({ stdout: '' }));
  return sessionKeyIn(stdout);
}

async function listeningPortsOf(processId: string): Promise<number[]> {
  const listed = await run('lsof', ['-nP', '-a', '-p', processId, '-iTCP', '-sTCP:LISTEN', '-Fn']).catch(() => ({ stdout: '' }));
  return [...listed.stdout.matchAll(/^n127\.0\.0\.1:(\d+)$/gm)].map((match) => Number(match[1]));
}

function ask(port: number, sessionKey: string): Promise<string> {
  return new Promise((resolve) => {
    const call = request(
      {
        host: '127.0.0.1',
        port,
        path: SUMMARY_PATH,
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
    call.end(REQUEST_BODY);
  });
}

function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
