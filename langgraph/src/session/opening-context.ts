export interface OpeningSession {
  readonly sessionDirectory: string;
  readonly workspaceRoot: string;
  readonly agentsRoot: string;
  readonly coreRules: string;
  readonly pullNotice: string;
  readonly handoffNotice?: string;
}

const NOTHING_TO_ADD = '';

const OPENING = [
  'This conversation is inside ibid-workspace. The workspace holds no rule files: the core rules',
  'below and the `assistant` skill are the only source of rules.',
  '',
  'Before answering the first message, invoke the `assistant` skill and act as it says for the',
  'whole conversation, including after the conversation is summarised. A question that changes',
  'nothing in the workspace is answered directly, still in the plain language the skill asks for.',
].join('\n');

export function openingContext(session: OpeningSession): string {
  const sections = sectionsFor(session).filter((section) => section !== '');
  if (sections.length === 0) {
    return NOTHING_TO_ADD;
  }
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: sections.join('\n\n') },
  });
}

export function watchesDirectory(session: Pick<OpeningSession, 'sessionDirectory' | 'workspaceRoot' | 'agentsRoot'>): boolean {
  return isInside(session.sessionDirectory, session.workspaceRoot) || isInside(session.sessionDirectory, session.agentsRoot);
}

export function sessionDirectoryOf(rawPayload: string): string {
  try {
    const payload: unknown = JSON.parse(rawPayload);
    return hasDirectory(payload) ? payload.cwd : '';
  } catch {
    return '';
  }
}

function sectionsFor(session: OpeningSession): readonly string[] {
  const handoff = session.handoffNotice ?? '';
  if (isInside(session.sessionDirectory, session.workspaceRoot)) {
    return [session.pullNotice, handoff, OPENING, session.coreRules];
  }
  if (isInside(session.sessionDirectory, session.agentsRoot)) {
    return [session.pullNotice, handoff];
  }
  return [];
}

function hasDirectory(payload: unknown): payload is { readonly cwd: string } {
  return typeof payload === 'object' && payload !== null && 'cwd' in payload && typeof payload.cwd === 'string';
}

function isInside(directory: string, root: string): boolean {
  return root !== '' && (directory === root || directory.startsWith(`${root}/`));
}
