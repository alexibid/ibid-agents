#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const AGENTS_ROOT = resolve(import.meta.dirname, '..');
const LANGGRAPH_SERVER = join(AGENTS_ROOT, 'langgraph', 'dist', 'server.js');
const GUARD = join(AGENTS_ROOT, 'langgraph', 'dist', 'guard.js');
const SKILLS = join(AGENTS_ROOT, 'skills');
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
  if (!existsSync(LANGGRAPH_SERVER) || !existsSync(GUARD)) {
    throw new UsageError('LangGraph is not built. Run "npm run build" inside langgraph/ first.');
  }
}

function readJson(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

function isLinkTo(link, target) {
  return lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink() === true && readlinkSync(link) === target;
}

function linkStep(link, target) {
  return {
    label: `link ${link}`,
    isInstalled: () => isLinkTo(link, target),
    blocker: () => (existsSync(link) ? 'a skill with this name is already there and is kept' : ''),
    install: () => {
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(target, link, 'dir');
    },
    remove: () => rmSync(link),
  };
}

function skillSteps(skillsHome) {
  return readdirSync(SKILLS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => linkStep(join(skillsHome, entry.name), join(SKILLS, entry.name)));
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
  const handler = { type: 'command', command: guardCommand(workspace), timeout: 10 };
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
  const entry = { matcher: CLAUDE_MATCHER, hooks: [{ type: 'command', command: guardCommand(workspace) }] };
  const others = (settings) => (settings.hooks?.PreToolUse ?? []).filter((hook) => !isGuardEntry(hook));
  return jsonStep(
    join(CLAUDE_HOME, 'settings.json'),
    `guard "${GUARD_NAME}" for Claude`,
    (settings) => (settings.hooks?.PreToolUse ?? []).some((hook) => sameJson(hook, entry)),
    (settings) => ({ ...settings, hooks: { ...settings.hooks, PreToolUse: [...others(settings), entry] } }),
    (settings) => ({ ...settings, hooks: { ...settings.hooks, PreToolUse: others(settings) } }),
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

function guardCommand(workspace) {
  return `IBID_WORKSPACE_ROOT='${workspace}' node '${GUARD}'`;
}

function isGuardEntry(hook) {
  return (hook.hooks ?? []).some((handler) => String(handler.command ?? '').includes(GUARD));
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
    ...skillSteps(join(CLAUDE_HOME, 'skills')),
    ...skillSteps(join(ANTIGRAVITY_HOME, 'skills')),
    claudeServerStep(workspace),
    antigravityServerStep(workspace),
    claudeGuardStep(workspace),
    antigravityGuardStep(workspace),
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
