# ibid-agents

The agent tooling that drives development: the flow engine, the agent contracts, the rules,
the skills and the installer. It lives in its own repository beside the workspace, not inside it.

| Field | Value |
| --- | --- |
| Path | `../ibid-agents` |
| Nx project | `ibid-agents` |
| Commit scope | `ibid-agents` |
| Delivery | Installed on the machine by `node install/install.mjs`; the flow engine runs from `langgraph/dist` |

## Mandatory steps

| Step | When |
| --- | --- |
| `plan`, `author-tests`, `implement`, `build`, `lint`, `rule-checks`, `unit-tests`, `validate-tests`, `review`, `final-verification` | `always` |

The repository has no linter of its own; `lint` runs the strict type check of the sources and
the specs.

## Checks

Commands run from the workspace root, so they reach the repository through its path.

| Step | Command |
| --- | --- |
| `build` | `npm --prefix ../ibid-agents/langgraph run build` |
| `lint` | `npm --prefix ../ibid-agents/langgraph run typecheck` |
| `unit-tests` | `npm --prefix ../ibid-agents/langgraph test` |

## Rules

- Plan paths start with `../ibid-agents/`, the repository's path from the workspace root.
- It is not an Nx project: no `nx` command, no `project.json`, no workspace sync check.
- Generalist steps and contracts stay general. A rule that belongs to one project lives in that
  project's sheet, never in the shared flow code or in a generalist contract.
- Tests never reach a real API, database or local data; they use fakes and fixtures.
- Text written into ibid-workspace (issues, docs, rules for its repositories) never mentions
  agents, skills or LangGraph; this repository may.
