export interface OpeningSession {
  readonly rawPayload: string;
  readonly workspaceRoot: string;
  readonly coreRules: string;
}

const NOTHING_TO_ADD = '';

const OPENING = [
  'This conversation is inside ibid-workspace. The workspace holds no rule files: the core rules',
  'below and the `assistente` skill are the only source of rules.',
  '',
  'Before answering the first message, invoke the `assistente` skill and act as it says for the',
  'whole conversation, including after the conversation is summarised. A question that changes',
  'nothing in the workspace is answered directly, still in the plain language the skill asks for.',
].join('\n');

export function openingContext({ rawPayload, workspaceRoot, coreRules }: OpeningSession): string {
  const sessionDirectory = sessionDirectoryOf(rawPayload);
  if (!isInside(sessionDirectory, workspaceRoot)) {
    return NOTHING_TO_ADD;
  }
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `${OPENING}\n\n${coreRules}` },
  });
}

function sessionDirectoryOf(rawPayload: string): string {
  try {
    const payload: unknown = JSON.parse(rawPayload);
    return hasDirectory(payload) ? payload.cwd : '';
  } catch {
    return '';
  }
}

function hasDirectory(payload: unknown): payload is { readonly cwd: string } {
  return typeof payload === 'object' && payload !== null && 'cwd' in payload && typeof payload.cwd === 'string';
}

function isInside(directory: string, workspaceRoot: string): boolean {
  return workspaceRoot !== '' && (directory === workspaceRoot || directory.startsWith(`${workspaceRoot}/`));
}
