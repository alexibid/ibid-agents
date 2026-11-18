# install

Connects Claude and Antigravity to this repository at the level of the user account, so the
workspace itself holds no agent file at all.

## Commands

| For | Command |
| --- | --- |
| See what the install would add | `node install/install.mjs <workspace path>` |
| Install | `node install/install.mjs <workspace path> --apply` |
| Undo the install | `node install/install.mjs <workspace path> --remove --apply` |
| See what would leave the workspace | `node install/clear-workspace.mjs <workspace path>` |
| Clear the workspace | `node install/clear-workspace.mjs <workspace path> --apply` |

Build LangGraph first: `npm run build` inside `langgraph/`.

## What the install adds

| Addition | Where | For |
| --- | --- | --- |
| A link to every skill in `skills/` | `~/.claude/skills/` | Claude |
| A link to every skill in `skills/` | `~/.gemini/config/skills/` | Antigravity |
| LangGraph as a tool server | Claude's user configuration | Claude |
| LangGraph as a tool server | `~/.gemini/config/mcp_config.json` | Antigravity |
| The guard, before commands and file writes | `~/.claude/settings.json` | Claude |
| The guard, before commands and file writes | `~/.gemini/config/hooks.json` | Antigravity |
| The assistant and the core rules at the start of every conversation | `~/.claude/settings.json` | Claude |
| The status line that hands Claude's limits to the monitor, unless another status line is set | `~/.claude/settings.json` | Claude |
| The official Nx plugin | `~/.claude/settings.json` | Claude |

A skill whose name already exists at the destination is skipped and the existing one is kept.

The guard is installed for the whole account but acts only in a session opened inside the
workspace. Everywhere else it allows everything.

## What the guard denies

| Rule | Denied |
| --- | --- |
| W36 | Any git command that changes state |
| W34 | Watch mode, and any server that names no port or names one the workspace reserves in a `project.json` |
| W05 | Calling the test runner, the compiler or the linter directly instead of through Nx |

A payload the guard cannot read is allowed, so a fault in the guard never locks the tools.

## Clearing the workspace

`clear-workspace.mjs` moves every agent file of the workspace to the Trash: the rule files at
the root and in each project, `.agents/`, `.gemini/` and `.claude/settings.json`, plus what
`nx configure-ai-agents` writes for other tools: `.opencode/`, `opencode.json` and
`.github/agents/`, `.github/prompts/` and `.github/skills/`. Claude gets those Nx skills from the
official Nx plugin instead. It refuses to
run unless each of them already has a copy under `legacy/ibid-workspace/`.

It keeps three things that only work from inside the workspace and hold no rule:
`.claude/launch.json`, `.claude/settings.local.json` and `.claude/worktrees/`.

## Consequences

- In Claude, a conversation opened inside the workspace starts with the core rules and the
  instruction to act as the assistant. It is added again when the conversation is resumed or
  summarised. It has not yet been seen in a new conversation.
- In Antigravity, a conversation that does not start with `/assistente` has no project rules,
  only the user's own global instructions.
- The guard does not yet deny edits made outside an active step, nor inline scripts (W41).
- The Antigravity guard follows the documented format and has not been seen working inside
  Antigravity.
