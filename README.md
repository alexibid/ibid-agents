# ibid-agents

Private home of the multi-project agent system across all user workspaces (`ibid-workspace`,
`lemon-mart`, `local-weather-alex`, and future projects). Nothing here ships with a product.
Individual project workspaces hold zero local agent files; all skills, rules, and configurations
are connected at the user account level (`~/.gemini/config/` and `~/.claude/`).

## What lives here

| Folder | Contents |
| --- | --- |
| `docs/` | The plan and the decisions behind it |
| `rules/` | Every rule, classified by how it is guaranteed, plus one sheet per project |
| `agents/` | One contract per agent: its single job, inputs, outputs, rules, tools, checks |
| `skills/` | Skills shared by every tool, in the open `SKILL.md` format |
| `langgraph/` | The LangGraph program that hands out one step at a time and verifies it |
| `database/` | The PostgreSQL database in Docker that keeps the journal, the memory, the usage and the limits |
| `monitor/` | The desktop dashboard (Angular and Tauri) that shows prompts, agents, tokens and limits |
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
agent has evaluations yet (`skills/<agent>/evals.json`, run with `npm run evals`). The Studio command-line tool brings five known advisories in its own
dependencies. Open questions are in `docs/decisions.md`.

Added on 2026-11-13: a PostgreSQL database in Docker; LangGraph writes every story and every
judged step to it; a memory of ideas, plans, decisions and research with its own agent, the
archivist; a monitor service that reads the conversation records of Claude and Antigravity and
their 5-hour and weekly limits; and the dashboard in `monitor/`.

Verified on 2026-11-13: the journal and the memory against the running database; the monitor
service against the real conversation records and the real Antigravity limits; the dashboard in
a browser against that service. Not yet: the new unit tests have not been run; the Claude limits
have not been seen arriving inside Claude Desktop; the Antigravity limits come from an
undocumented local interface that an update may change; the percentage a prompt spent is only
known for prompts made while the monitor service was running.

## Agent flows and checks (2026-11-15)

- `skills/` holds the user's own agents and the LangGraph roles; `system-skills/` holds vendor
  skills; `projects/<project>/` holds the agent files of other projects, linked back into them.
- Each of the user's own agents has its own LangGraph flow in `skills/<agent>/flow.json`, built
  by `langgraph/src/agent-runs/`. LangGraph passes a step only when its hand-back is complete:
  links must open, files must exist, and a user approval must quote the user's words.
- A hook in Claude (`UserPromptSubmit`) and Antigravity (`PreInvocation`) reminds an agent with a
  flow to start it whenever the user names it.
- `skills/<agent>/evals.json` holds evaluation cases, run with `npm run evals -- <agent>` in
  `langgraph/` and shown in the dashboard.

Verified on 2026-11-15: the 159 LangGraph tests and 31 dashboard tests pass, and all 7 evaluation
cases pass through the Claude command line, each going through its agent's flow. Not yet
verified: the Antigravity reminder follows the documented hook format but has not been seen
working, and no real user story has gone through the whole circuit.

