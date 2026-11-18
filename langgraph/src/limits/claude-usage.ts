import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isObject, numberIn, objectIn, textIn, type JsonObject } from '../usage/json-reading.js';
import { samplesOfClaudeUsage, type LimitSample } from './limit-sample.js';

const run = promisify(execFile);
const KEYCHAIN_ENTRY = 'Claude Code-credentials';
const TOKEN_ENDPOINT = 'https://platform.claude.com/v1/oauth/token';
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
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
  const raw = parsedObject(stored.stdout);
  const signIn = objectIn(raw, 'claudeAiOauth');
  const accessToken = textIn(signIn, 'accessToken');
  const expiresAt = numberIn(signIn, 'expiresAt');

  if (accessToken !== '' && expiresAt > Date.now()) {
    return accessToken;
  }

  const refreshToken = textIn(signIn, 'refreshToken');
  const refreshExpiresAt = numberIn(signIn, 'refreshTokenExpiresAt');
  if (refreshToken === '' || (refreshExpiresAt > 0 && refreshExpiresAt <= Date.now())) {
    return NO_SIGN_IN;
  }

  return refreshAccessToken(raw, signIn, refreshToken);
}

async function refreshAccessToken(raw: JsonObject, signIn: JsonObject, refreshToken: string): Promise<string> {
  const scopes = Array.isArray(signIn['scopes']) ? signIn['scopes'].filter((s): s is string => typeof s === 'string') : [];
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      ...(scopes.length > 0 ? { scope: scopes.join(' ') } : {}),
    }),
    signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS),
  }).catch(() => undefined);

  if (response?.ok !== true) {
    return NO_SIGN_IN;
  }

  const body = (await response.json().catch(() => ({}))) as JsonObject;
  const newAccessToken = textIn(body, 'access_token');
  const expiresIn = numberIn(body, 'expires_in');
  const newRefreshToken = textIn(body, 'refresh_token') || refreshToken;
  const refreshExpiresIn = numberIn(body, 'refresh_token_expires_in');

  if (newAccessToken === '') {
    return NO_SIGN_IN;
  }

  const updatedSignIn: Record<string, unknown> = {
    ...signIn,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  if (refreshExpiresIn > 0) {
    updatedSignIn['refreshTokenExpiresAt'] = Date.now() + refreshExpiresIn * 1000;
  }

  const updatedRaw = {
    ...raw,
    claudeAiOauth: updatedSignIn,
  };

  const user = process.env['USER'] ?? 'alexsantos';
  const hexPayload = Buffer.from(JSON.stringify(updatedRaw), 'utf8').toString('hex');
  await run('security', ['add-generic-password', '-U', '-a', user, '-s', KEYCHAIN_ENTRY, '-X', hexPayload]).catch(() => undefined);

  return newAccessToken;
}

function parsedObject(text: string): JsonObject {
  try {
    const value: unknown = JSON.parse(text);
    return isObject(value) ? value : {};
  } catch {
    return {};
  }
}
