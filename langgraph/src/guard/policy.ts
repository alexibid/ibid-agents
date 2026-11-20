export interface Attempt {
  readonly command: string;
  readonly filePath: string;
  readonly workspaceRoot: string;
  readonly reservedPorts: readonly number[];
  readonly activeFlow?: boolean;
}

export interface Ruling {
  readonly allowed: boolean;
  readonly rule: string;
  readonly reason: string;
}

interface CommandBan {
  readonly rule: string;
  readonly pattern: RegExp;
  readonly reason: string;
  readonly everywhere: boolean;
}

const ALLOWED: Ruling = { allowed: true, rule: '', reason: '' };

const GIT_PREFIX = String.raw`\bgit\s+(?:-C\s+\S+\s+|-c\s+\S+\s+)*`;
const GIT_WRITE_VERBS =
  'add|commit|push|pull|merge|rebase|tag|checkout|switch|restore|reset|stash(?!\\s+list)|cherry-pick|revert|clean|rm|mv|apply|am|init|clone|worktree(?!\\s+list)';
const SEGMENT_START = String.raw`(?:^|&&|\|\||;|\|)\s*(?:npx\s+(?:--no-install\s+|-y\s+)?)?`;

const COMMAND_BANS: readonly CommandBan[] = [
  {
    rule: 'W36',
    pattern: new RegExp(`${GIT_PREFIX}(?:${GIT_WRITE_VERBS})\\b`),
    reason: 'Git is read-only for agents. The commit belongs to the user.',
    everywhere: true,
  },
  {
    rule: 'W36',
    pattern: new RegExp(`${GIT_PREFIX}(?:branch\\s+-[dDmMcC]|submodule\\s+(?:add|update|deinit|sync)|remote\\s+(?:add|remove|set-url))\\b`),
    reason: 'Git is read-only for agents. The commit belongs to the user.',
    everywhere: true,
  },
  {
    rule: 'W34',
    pattern: /(?:^|\s)--watch(?!=false)\b/,
    reason: 'Watch mode is forbidden.',
    everywhere: false,
  },
  {
    rule: 'W05',
    pattern: new RegExp(`${SEGMENT_START}(?:vitest|playwright|ng(?!\\s+serve)|tsc|jest|eslint)\\b`),
    reason: 'Tasks run through Nx, never the underlying tool. The flow engine runs validation.',
    everywhere: false,
  },
];

const SERVER_COMMAND =
  /\bng\s+serve\b|\bnx\s+(?:run\s+)?\S*:?(?:serve(?:-static|-e2e|-app)?|storybook)\b|\bstorybook(?::start|:product|\s+dev)\b|\bnpm\s+(?:run\s+)?start\b/;
const NAMED_PORT = /(?:--port[= ]|\s-p\s+|\bPORT=)(\d{2,5})/g;
const LEADING_DIRECTORY_CHANGE = /^\s*cd\s+("[^"]+"|'[^']+'|\S+)/;

export function ruleOn(attempt: Attempt): Ruling {
  if (attempt.filePath !== '') {
    return ruleOnFile(attempt);
  }
  return attempt.command === '' ? ALLOWED : ruleOnCommand(attempt);
}

function ruleOnFile({ filePath, workspaceRoot, activeFlow }: Attempt): Ruling {
  if (activeFlow === false && isInsideWorkspace(filePath, workspaceRoot)) {
    return {
      allowed: false,
      rule: 'W60',
      reason: 'Every change in ibid-workspace must run through the flow engine (call start_story or start_agent_run on ibid-langgraph first).',
    };
  }
  return ALLOWED;
}

function ruleOnCommand(attempt: Attempt): Ruling {
  const insideWorkspace = runsInsideWorkspace(attempt.command, attempt.workspaceRoot);
  const broken = COMMAND_BANS.find((ban) => (ban.everywhere || insideWorkspace) && ban.pattern.test(attempt.command));
  if (broken !== undefined) {
    return { allowed: false, rule: broken.rule, reason: broken.reason };
  }
  return insideWorkspace && SERVER_COMMAND.test(attempt.command) ? ruleOnServer(attempt) : ALLOWED;
}

function ruleOnServer({ command, reservedPorts }: Attempt): Ruling {
  const ports = [...command.matchAll(NAMED_PORT)].map((match) => Number(match[1]));
  const reserved = reservedPorts.join(', ');
  if (ports.length === 0) {
    return {
      allowed: false,
      rule: 'W34',
      reason: `A server must name its port with --port, outside the ports the workspace reserves (${reserved}).`,
    };
  }
  const taken = ports.find((port) => reservedPorts.includes(port));
  return taken === undefined
    ? ALLOWED
    : { allowed: false, rule: 'W34', reason: `Port ${taken} is reserved by the workspace (${reserved}). Choose another.` };
}

function runsInsideWorkspace(command: string, workspaceRoot: string): boolean {
  const target = LEADING_DIRECTORY_CHANGE.exec(command)?.[1]?.replace(/^["']|["']$/g, '');
  if (target === undefined || !target.startsWith('/')) {
    return true;
  }
  return isInsideWorkspace(target, workspaceRoot);
}

function isInsideWorkspace(path: string, workspaceRoot: string): boolean {
  return workspaceRoot !== '' && (path === workspaceRoot || path.startsWith(`${workspaceRoot}/`));
}
