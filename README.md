# ibid-agents

Private home of the agent system that develops `ibid-workspace`. Nothing here ships with a
product. The workspace holds only untracked links into this repository.

## What lives here

| Folder | Contents |
| --- | --- |
| `docs/` | The plan and the decisions behind it |
| `rules/` | Every rule, classified by how it is guaranteed, plus one sheet per project |
| `agents/` | One contract per agent: its single job, inputs, outputs, rules, tools, checks |
| `skills/` | Skills shared by every tool, in the open `SKILL.md` format |
| `langgraph/` | The LangGraph program that hands out one step at a time and verifies it |
| `guards/` | Hooks that block forbidden actions in Claude and Antigravity |
| `mcp/` | The single list of MCP servers, rendered into each tool's own config |
| `install/` | The scripts that connect the tools to this repository and clear the workspace |
| `legacy/` | The agent files as they were inside `ibid-workspace`, kept for reference |

## Vocabulary

| Term | Meaning |
| --- | --- |
| Assistant | The user's single point of contact. Prepares user stories and acceptance criteria |
| Specialist | One per project. Plans the work and calls the agents it needs |
| LangGraph | The program, built with LangGraph, that owns the step order and the checks. It never writes code |
| Guard | A hook that denies a forbidden action at the moment it is attempted |
| Project sheet | A project's own rules, mandatory steps, checks and available agents |

## Status

Done on 2026-11-11: every agent file left `ibid-workspace`, after a backup on the Desktop. The
skills, the LangGraph tool server, the guard and the Nx plugin are installed at the level of the
user account for Claude and Antigravity.

Verified: LangGraph and the guard compile; the redrawn graph ran a whole story against a
throwaway workspace; the guard is live and blocked a real command in the workspace; the Studio
server starts and lists the graph.

Not yet: the unit tests have not been run, `/assistente` has not been used on a real story,
Studio has not been opened in a browser, the Antigravity side has not been seen working, and no
agent has trials. The Studio command-line tool brings five known advisories in its own
dependencies. Open questions are in `docs/decisions.md`.
