import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isObject, numberIn, objectIn, textIn, type JsonObject } from '../usage/json-reading.js';
import { samplesOfClaudeUsage, type LimitSample } from './limit-sample.js';

const run = promisify(execFile);
const KEYCHAIN_ENTRY = 'Claude Code-credentials';
const USAGE_ADDRESS = 'https://api.anthropic.com/api/oauth/usage';
const ANSWER_TIMEOUT_MS = 6000;
const NO_SIGN_IN = '';

export async function readClaudeUsage(): Promise<LimitSample[]> {
  const accessToken = await validSignIn();
  if (accessToken === NO_SIGN_IN) {
    return [];
  }
  const response = await fetch(USAGE_ADDRESS, {
    headers: { Authorization: `Bearer ${accessToken}`, 'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': 'ibid-agents-monitor' },
    signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS),
  }).catch(() => undefined);
  if (response?.ok !== true) {
    return [];
  }
  return samplesOfClaudeUsage(await response.json().catch(() => ({})));
}

async function validSignIn(): Promise<string> {
  const stored = await run('security', ['find-generic-password', '-s', KEYCHAIN_ENTRY, '-w']).catch(() => ({ stdout: '' }));
  const signIn = objectIn(parsedObject(stored.stdout), 'claudeAiOauth');
  const accessToken = textIn(signIn, 'accessToken');
  return accessToken !== '' && numberIn(signIn, 'expiresAt') > Date.now() ? accessToken : NO_SIGN_IN;
}

function parsedObject(text: string): JsonObject {
  try {
    const value: unknown = JSON.parse(text);
    return isObject(value) ? value : {};
  } catch {
    return {};
  }
}
