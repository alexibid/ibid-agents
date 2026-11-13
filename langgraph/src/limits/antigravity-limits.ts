import { execFile } from 'node:child_process';
import { Agent, request } from 'node:https';
import { promisify } from 'node:util';
import { samplesOfAntigravitySummary, type LimitSample } from './limit-sample.js';

interface LanguageServer {
  readonly processId: string;
  readonly sessionKey: string;
}

const run = promisify(execFile);
const SUMMARY_PATH = '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary';
const REQUEST_BODY = JSON.stringify({ metadata: { ideName: 'antigravity', extensionName: 'antigravity', locale: 'en' } });
const TRUSTS_LOCAL_CERTIFICATE = new Agent({ rejectUnauthorized: false });
const ANSWER_TIMEOUT_MS = 4000;
const NO_ANSWER = '';

export async function readAntigravityLimits(): Promise<LimitSample[]> {
  const server = await runningLanguageServer();
  if (server === undefined) {
    return [];
  }
  for (const port of await listeningPortsOf(server.processId)) {
    const samples = samplesOfAntigravitySummary(parsed(await ask(port, server.sessionKey)));
    if (samples.length > 0) {
      return samples;
    }
  }
  return [];
}

async function runningLanguageServer(): Promise<LanguageServer | undefined> {
  const { stdout } = await run('ps', ['-axo', 'pid=,command=']);
  const line = stdout.split('\n').find((entry) => entry.includes('language_server') && entry.includes('--csrf_token'));
  const processId = /^\s*(\d+)/.exec(line ?? '')?.[1];
  const sessionKey = /--csrf_token[= ](\S+)/.exec(line ?? '')?.[1];
  return processId === undefined || sessionKey === undefined ? undefined : { processId, sessionKey };
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
