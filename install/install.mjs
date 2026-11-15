#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const AGENTS_ROOT = resolve(import.meta.dirname, '..');
const LANGGRAPH_SERVER = join(AGENTS_ROOT, 'langgraph', 'dist', 'server.js');
const GUARD = join(AGENTS_ROOT, 'langgraph', 'dist', 'guard.js');
const SESSION_START = join(AGENTS_ROOT, 'langgraph', 'dist', 'session-start.js');
const STATUS_LINE = join(AGENTS_ROOT, 'langgraph', 'dist', 'status-line.js');
const FLOW_REMINDER = join(AGENTS_ROOT, 'langgraph', 'dist', 'flow-reminder.js');
const FLOW_REMINDER_NAME = 'ibid-flow-reminder';
const SKILLS = join(AGENTS_ROOT, 'skills');
const SYSTEM_SKILLS = join(AGENTS_ROOT, 'system-skills');
const INSTRUCTIONS = join(AGENTS_ROOT, 'instructions');
const SHARED_SKILLS = join(homedir(), '.agents', 'skills');
const ANTIGRAVITY_AGENTS = join(AGENTS_ROOT, 'antigravity', 'agents');
const CLAUDE_HOME = join(homedir(), '.claude');
const ANTIGRAVITY_HOME = join(homedir(), '.gemini', 'config');
const SERVER_NAME = 'ibid-langgraph';
const GUARD_NAME = 'ibid-guard';
const NX_MARKETPLACE = 'nx-claude-plugins';
const NX_PLUGIN = `nx@${NX_MARKETPLACE}`;
const CLAUDE_MATCHER = 'Bash|Write|Edit|MultiEdit|NotebookEdit';
const ANTIGRAVITY_MATCHER = 'run_command|write_to_file|replace_file_content|multi_replace_file_content';

class UsageError extends Error {}

function readArguments(argv) {
  const workspace = argv.find((argument) => !argument.startsWith('--'));
  if (workspace === undefined) {
    throw new UsageError('Usage: node install/install.mjs <workspace path> [--apply] [--remove]');
  }
  return { workspace: resolve(workspace), apply: argv.includes('--apply'), remove: argv.includes('--remove') };
}

function assertReady(workspace) {
  if (!existsSync(join(workspace, 'nx.json'))) {
    throw new UsageError(`${workspace} is not an Nx workspace.`);
  }
  if (![LANGGRAPH_SERVER, GUARD, SESSION_START, STATUS_LINE, FLOW_REMINDER].every((script) => existsSync(script))) {
    throw new UsageError('LangGraph is not built. Run "npm run build" inside langgraph/ first.');
  }
}

function readJson(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

function isLinkTo(link, target) {
  if (lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink() !== true) {
    return false;
  }
  return readlinkSync(link) === target || resolvesTo(link, target);
}

function resolvesTo(link, target) {
  try {
    return realpathSync(link) === realpathSync(target);
  } catch {
    return false;
  }
}

function linkStep(link, target, type = 'dir') {
  return {
    label: `link ${link}`,
    isInstalled: () => isLinkTo(link, target),
    blocker: () => (existsSync(link) ? 'a skill with this name is already there and is kept' : ''),
    install: () => {
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(target, link, type);
    },
    remove: () => rmSync(link),
  };
}

function skillSteps(skillsHome) {
  return [SKILLS, SYSTEM_SKILLS].flatMap((source) =>
    readdirSync(source, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => linkStep(join(skillsHome, entry.name), join(source, entry.name))),
  );
}

function pruneStep(skillsHome) {
  const stale = () =>
    readdirSync(skillsHome, { withFileTypes: true })
      .map((entry) => join(skillsHome, entry.name))
      .filter((link) => lstatSync(link).isSymbolicLink() && !existsSync(link) && pointsIntoThisRepository(link));
  return {
    label: `remove links in ${skillsHome} to skills that no longer exist`,
    isInstalled: () => stale().length === 0,
    blocker: () => '',
    install: () => stale().forEach((link) => rmSync(link)),
    remove: () => undefined,
  };
}

function pointsIntoThisRepository(link) {
  const target = readlinkSync(link);
  return target.startsWith(AGENTS_ROOT) || target.startsWith(SHARED_SKILLS);
}

function jsonStep(file, label, isInstalled, withEntry, withoutEntry) {
  const save = (content) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`);
  };
  return {
    label: `${label} in ${file}`,
    isInstalled: () => isInstalled(readJson(file)),
    blocker: () => '',
    install: () => save(withEntry(readJson(file))),
    remove: () => save(withoutEntry(readJson(file))),
  };
}

function sameJson(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function antigravityServerStep(workspace) {
  const entry = { command: 'node', args: [LANGGRAPH_SERVER], env: { IBID_WORKSPACE_ROOT: workspace } };
  return jsonStep(
    join(ANTIGRAVITY_HOME, 'mcp_config.json'),
    `tool server "${SERVER_NAME}" for Antigravity`,
    (config) => sameJson(config.mcpServers?.[SERVER_NAME], entry),
    (config) => ({ ...config, mcpServers: { ...config.mcpServers, [SERVER_NAME]: entry } }),
    (config) => ({ ...config, mcpServers: omit(config.mcpServers, SERVER_NAME) }),
  );
}

function antigravityGuardStep(workspace) {
  const handler = { type: 'command', command: scriptCommand(workspace, GUARD), timeout: 10 };
  const entry = { PreToolUse: [{ matcher: ANTIGRAVITY_MATCHER, hooks: [handler] }] };
  return jsonStep(
    join(ANTIGRAVITY_HOME, 'hooks.json'),
    `guard "${GUARD_NAME}" for Antigravity`,
    (hooks) => sameJson(hooks[GUARD_NAME], entry),
    (hooks) => ({ ...hooks, [GUARD_NAME]: entry }),
    (hooks) => omit(hooks, GUARD_NAME),
  );
}

function claudeGuardStep(workspace) {
  const entry = { matcher: CLAUDE_MATCHER, hooks: [{ type: 'command', command: scriptCommand(workspace, GUARD) }] };
  return claudeHookStep({ event: 'PreToolUse', script: GUARD, entry, label: `guard "${GUARD_NAME}" for Claude` });
}

function claudeSessionStartStep(workspace) {
  const entry = { hooks: [{ type: 'command', command: scriptCommand(workspace, SESSION_START) }] };
  return claudeHookStep({ event: 'SessionStart', script: SESSION_START, entry, label: 'the assistant at the start of every Claude conversation' });
}

function claudeStatusLineStep() {
  const file = join(CLAUDE_HOME, 'settings.json');
  const entry = { type: 'command', command: `node '${STATUS_LINE}'` };
  const step = jsonStep(
    file,
    'the status line that hands Claude limits to the monitor',
    (settings) => sameJson(settings.statusLine, entry),
    (settings) => ({ ...settings, statusLine: entry }),
    (settings) => omit(settings, 'statusLine'),
  );
  const another = () => readJson(file).statusLine !== undefined && !sameJson(readJson(file).statusLine, entry);
  return { ...step, blocker: () => (another() ? 'another status line is already set and is kept' : '') };
}

function claudeFlowReminderStep(workspace) {
  const entry = { hooks: [{ type: 'command', command: scriptCommand(workspace, FLOW_REMINDER) }] };
  return claudeHookStep({ event: 'UserPromptSubmit', script: FLOW_REMINDER, entry, label: 'the reminder to run an agent through its flow, for Claude' });
}

function antigravityFlowReminderStep(workspace) {
  const entry = { PreInvocation: [{ hooks: [{ type: 'command', command: scriptCommand(workspace, FLOW_REMINDER), timeout: 10 }] }] };
  return jsonStep(
    join(ANTIGRAVITY_HOME, 'hooks.json'),
    'the reminder to run an agent through its flow, for Antigravity',
    (hooks) => sameJson(hooks[FLOW_REMINDER_NAME], entry),
    (hooks) => ({ ...hooks, [FLOW_REMINDER_NAME]: entry }),
    (hooks) => omit(hooks, FLOW_REMINDER_NAME),
  );
}

function claudeHookStep({ event, script, entry, label }) {
  const others = (settings) => (settings.hooks?.[event] ?? []).filter((hook) => !runsScript(hook, script));
  return jsonStep(
    join(CLAUDE_HOME, 'settings.json'),
    label,
    (settings) => (settings.hooks?.[event] ?? []).some((hook) => sameJson(hook, entry)),
    (settings) => ({ ...settings, hooks: { ...settings.hooks, [event]: [...others(settings), entry] } }),
    (settings) => ({ ...settings, hooks: { ...settings.hooks, [event]: others(settings) } }),
  );
}

function claudeNxPluginStep() {
  const marketplace = { source: { source: 'github', repo: 'nrwl/nx-ai-agents-config' } };
  return jsonStep(
    join(CLAUDE_HOME, 'settings.json'),
    'the official Nx plugin for Claude',
    (settings) => settings.enabledPlugins?.[NX_PLUGIN] === true,
    (settings) => ({
      ...settings,
      extraKnownMarketplaces: { ...settings.extraKnownMarketplaces, [NX_MARKETPLACE]: marketplace },
      enabledPlugins: { ...settings.enabledPlugins, [NX_PLUGIN]: true },
    }),
    (settings) => ({
      ...settings,
      extraKnownMarketplaces: omit(settings.extraKnownMarketplaces, NX_MARKETPLACE),
      enabledPlugins: omit(settings.enabledPlugins, NX_PLUGIN),
    }),
  );
}

function claudeServerStep(workspace) {
  const claude = (argumentsList) => spawnSync('claude', argumentsList, { encoding: 'utf8' });
  const added = ['mcp', 'add', '--scope', 'user', SERVER_NAME, '-e', `IBID_WORKSPACE_ROOT=${workspace}`, '--', 'node', LANGGRAPH_SERVER];
  return {
    label: `tool server "${SERVER_NAME}" for Claude (claude ${added.join(' ')})`,
    isInstalled: () => claude(['mcp', 'get', SERVER_NAME]).status === 0,
    blocker: () => (claude(['--version']).status === 0 ? '' : 'the "claude" command is not available; run the command above by hand'),
    install: () => assertSucceeded(claude(added)),
    remove: () => assertSucceeded(claude(['mcp', 'remove', '--scope', 'user', SERVER_NAME])),
  };
}

function scriptCommand(workspace, script) {
  return `IBID_WORKSPACE_ROOT='${workspace}' node '${script}'`;
}

function runsScript(hook, script) {
  return (hook.hooks ?? []).some((handler) => String(handler.command ?? '').includes(script));
}

function omit(record = {}, key) {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

function assertSucceeded(result) {
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'the command failed').trim());
  }
}

function stepsFor(workspace) {
  return [
    linkStep(SHARED_SKILLS, SKILLS),
    linkStep(join(ANTIGRAVITY_HOME, 'agents'), ANTIGRAVITY_AGENTS),
    linkStep(join(CLAUDE_HOME, 'CLAUDE.md'), join(INSTRUCTIONS, 'claude', 'CLAUDE.md'), 'file'),
    linkStep(join(homedir(), '.gemini', 'GEMINI.md'), join(INSTRUCTIONS, 'gemini', 'GEMINI.md'), 'file'),
    linkStep(join(ANTIGRAVITY_HOME, 'AGENTS.md'), join(INSTRUCTIONS, 'antigravity', 'AGENTS.md'), 'file'),
    linkStep(join(homedir(), '.codex', 'AGENTS.md'), join(INSTRUCTIONS, 'codex', 'AGENTS.md'), 'file'),
    pruneStep(join(CLAUDE_HOME, 'skills')),
    pruneStep(join(ANTIGRAVITY_HOME, 'skills')),
    ...skillSteps(join(CLAUDE_HOME, 'skills')),
    ...skillSteps(join(ANTIGRAVITY_HOME, 'skills')),
    claudeServerStep(workspace),
    antigravityServerStep(workspace),
    claudeGuardStep(workspace),
    antigravityGuardStep(workspace),
    claudeSessionStartStep(workspace),
    claudeFlowReminderStep(workspace),
    antigravityFlowReminderStep(workspace),
    claudeStatusLineStep(),
    claudeNxPluginStep(),
  ];
}

function describe(step, remove) {
  const installed = step.isInstalled();
  if (remove) {
    return installed ? 'remove' : 'absent';
  }
  const blocker = installed ? '' : step.blocker();
  return installed ? 'present' : blocker === '' ? 'add' : `skip: ${blocker}`;
}

function run({ workspace, apply, remove }) {
  assertReady(workspace);
  for (const step of stepsFor(workspace)) {
    const action = describe(step, remove);
    console.log(`[${action}] ${step.label}`);
    if (apply && action === 'add') {
      step.install();
    }
    if (apply && action === 'remove') {
      step.remove();
    }
  }
  console.log(apply ? 'Done.' : 'Nothing was changed. Add --apply to make these changes.');
}

try {
  run(readArguments(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
