import type { Attempt, Ruling } from './policy.js';

export interface ToolDialect {
  readonly attempt: Attempt;
  readonly sessionDirectories: readonly string[];
  readonly answer: (ruling: Ruling) => string;
}

type JsonObject = Readonly<Record<string, unknown>>;

interface Surroundings {
  readonly workspaceRoot: string;
  readonly reservedPorts: readonly number[];
  readonly activeFlow?: boolean;
}

export function readPayload(rawPayload: string, workspaceRoot: string, reservedPorts: readonly number[], activeFlow = true): ToolDialect {
  const payload = parse(rawPayload);
  const surroundings = { workspaceRoot, reservedPorts, activeFlow };
  return isObject(payload['toolCall']) ? antigravity(payload, payload['toolCall'], surroundings) : claude(payload, surroundings);
}

function claude(payload: JsonObject, surroundings: Surroundings): ToolDialect {
  const input = isObject(payload['tool_input']) ? payload['tool_input'] : {};
  const filePath = text(input['file_path']);
  return {
    attempt: { command: text(input['command']), filePath, ...surroundings },
    sessionDirectories: [text(payload['cwd']), filePath],
    answer: (ruling) =>
      ruling.allowed
        ? ''
        : JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'deny',
              permissionDecisionReason: `${ruling.rule}: ${ruling.reason}`,
            },
          }),
  };
}

function antigravity(payload: JsonObject, toolCall: JsonObject, surroundings: Surroundings): ToolDialect {
  const args = isObject(toolCall['args']) ? toolCall['args'] : {};
  const filePath = text(args['Path']) || text(args['TargetFile']);
  return {
    attempt: { command: text(args['CommandLine']), filePath, ...surroundings },
    sessionDirectories: [...texts(payload['workspacePaths']), text(args['Cwd']), filePath],
    answer: (ruling) =>
      JSON.stringify(
        ruling.allowed ? { decision: 'allow' } : { decision: 'deny', reason: `${ruling.rule}: ${ruling.reason}` },
      ),
  };
}

function parse(rawPayload: string): JsonObject {
  try {
    const parsed: unknown = JSON.parse(rawPayload);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function texts(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text) : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
