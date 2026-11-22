const LANGUAGE_SERVER_ENTRY = /^\s*(\d+)\s+\/(?:\S|\s(?!-))*?\/bin\/language_server(?:\s|$)/;
const SESSION_KEY_SOURCES: readonly RegExp[] = [/--csrf_token[= ](\S+)/, /(?:^|\s)ANTIGRAVITY_SERVER_CSRF_TOKEN=(\S+)/];

export function languageServerProcessIdsIn(processList: string): string[] {
  return processList.split('\n').flatMap((entry) => {
    const processId = LANGUAGE_SERVER_ENTRY.exec(entry)?.[1];
    return processId === undefined ? [] : [processId];
  });
}

export function sessionKeyIn(commandWithEnvironment: string): string | undefined {
  for (const source of SESSION_KEY_SOURCES) {
    const key = source.exec(commandWithEnvironment)?.[1];
    if (key !== undefined) {
      return key;
    }
  }
  return undefined;
}
