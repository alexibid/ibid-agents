# Decisions

Settled with the user. A decision here overrides any older rule file that says otherwise.

| Date | Decision | Replaces |
| --- | --- | --- |
| 2026-11-11 | LangGraph is a requirement of this system | — |
| 2026-11-11 | The user works inside Claude Desktop and Antigravity; no command line, no new chat app | — |
| 2026-11-11 | LangGraph runs unit tests, journeys and accessibility checks | "The user runs all tests" in every rule file |
| 2026-11-11 | LangGraph runs every validation command; no agent chooses when to validate | "Run `check:fast`" in project files and "never run `check:fast` unprompted" in the workspace file |
| 2026-11-11 | A commit has no file limit | "At most 10 files per commit" in `oh-save-me` |
| 2026-11-11 | Comments are forbidden, with one written exception: `secretlint-disable` for a confirmed false positive | The undeclared exception in the workspace file |
| 2026-11-11 | Agent scripts live in this repository | "Always write scripts under `tools/scratch/`" |
| 2026-11-11 | `camila` is removed from every rule | References in `oh-save-me`, `boilerplate` and `ibid-ui` |
| 2026-11-11 | The commit is always the user's; agents never change git state | Unchanged, restated |
| 2026-11-11 | Antigravity is never wrapped by another application | — |
| 2026-11-12 | An agent may start a server, on a port named with `--port` that no `project.json` declares. Watch mode stays forbidden | "Never run watch mode or synchronous servers" |
| 2026-11-12 | The workspace holds no agent file. Skills, tool server and guard are installed at the level of the user account; the old files are kept under `legacy/` | The earlier plan to leave links inside the workspace |
| 2026-11-12 | Nothing of any agent tool stays in the workspace: `.claude/` and `.gemini/` leave it completely, in the root and in every project. A backup goes to the Desktop first | Keeping `launch.json`, `settings.local.json` and `worktrees` |
| 2026-11-12 | The graph has one node per step, and LangSmith Studio is set up to view it | The two-node graph |
| 2026-11-12 | The program is called LangGraph, in prose and in code (`langgraph/`, `ibid-langgraph`) | The name "referee" |
| 2026-11-12 | The handover is a ready command per repository: `cd <absolute path> && git add -- <this story's files> && git commit -m <line>`. Files that already held earlier work are never staged | "No git commands" in the handover rules |
| 2026-11-12 | `SavvyJar` is retired; the project is `oh-save-me` | The rule that protected the `SavvyJar` repository |
| 2026-11-13 | A conversation opened inside the workspace starts as the assistant, with the core rules, without `/assistente` being typed (Claude) | Having to invoke the assistant in every conversation |
| 2026-11-13 | One PostgreSQL database in Docker keeps the journal, the memory, the usage and the limits. TimescaleDB is not used at this volume | The SQLite-only state |
| 2026-11-13 | The memory matches words, in Portuguese and English, inside the database. No outside service and no key | — |
| 2026-11-13 | The dashboard lives in this repository, is a Tauri application, keeps state with signals and only observes: the user keeps talking in Claude Desktop and Antigravity | A dashboard inside `ibid-workspace`; NgRx |
| 2026-11-13 | Tokens are read from the conversation records both tools write on disk | — |
| 2026-11-13 | Antigravity limits are read from its local process with its session key, held in memory only. The user approved this undocumented route | Showing Antigravity limits as unknown |
| 2026-11-13 | The percentage a prompt spent is the difference between the limit read before and after it, per tool. It is approximate when two conversations run at once | — |
| 2026-11-13 | Claude Desktop does not run the status line, so Claude's percentages are estimated: the tokens spent before each time Claude refused for a limit give that limit's size per model, and each prompt is a share of it. Shown with ≈ | Showing Claude's percentages as unknown |
| 2026-11-13 | The graph of a prompt shows everything the assistant called (LangGraph, agents, skills and tools) and warns when it bypassed LangGraph and the agents | A graph of agents only |
| 2026-11-13 | Every agent on the machine lives in this repository: skills in `skills/` (the user's own and the LangGraph roles) and `system-skills/` (vendor skills such as Firebase and Nx); Antigravity's own agents in `antigravity/agents/`; the global instruction files in `instructions/`. The old places hold links | Agents scattered across `~/.agents`, `~/.gemini` and `~/.claude` |
| 2026-11-13 | Claude and Antigravity see exactly the same skills, and every one is invoked by `/name` | Each tool with its own set |
| 2026-11-13 | Each LangGraph contract in `agents/` has a skill of the same name that only points to it, so the role can also be invoked on its own | Contracts reachable only through LangGraph |
| 2026-11-13 | Duplicates merged into one: `qa-tester` and `playwright` into the test and browser contracts, `code-auditor` into `reviewer`, `visual-qa` and its scripts into `visual-gate`, `cv-generator` into `job`, `design-system-specialist` into `ui`, `web-design` and the oh-save-me sheet; the `agents` skill dropped. The originals are in `legacy/merged-skills/` | — |
| 2026-11-13 | The user's own skills can be removed from the dashboard; they go to the Mac Trash and their links leave both tools. LangGraph roles and system skills cannot be removed there | — |
| 2026-11-13 | The agent files of other projects (BoilerStudio, cv, personal-finance, trader, job-suite, poupado-app, wealth-simulator) live in `projects/<project>/`; each project keeps links. Each project agent is callable from Claude and Antigravity inside its project. `job-suite` became a shared skill | Agent files scattered in each project |
| 2026-11-15 | Each of the user's own agents has its own LangGraph flow, described in `flow.json` beside its skill and built by one shared engine. LangGraph hands out one step at a time and only passes a step whose hand-back is complete; a step done by the user needs their own words. Three failed attempts stop the run for the user | Agents working without LangGraph |
| 2026-11-15 | Flow steps check content where they can: links must open, files must exist | Checking only that fields are filled |
| 2026-11-15 | Naming an agent with a flow makes the tool remind it to start the flow (Claude `UserPromptSubmit`, Antigravity `PreInvocation`) | Relying on the skill text alone |
| 2026-11-15 | Agents are evaluated with cases in `evals.json`, run through the Claude command line and kept in the database. Agents that act on the user's accounts or files are not run automatically | Trials folders that were never written |
| 2026-11-18 | All issues, comments, backlog items and texts of `ibid-workspace` and its repositories are written exclusively in English, and nothing in `ibid-workspace` or its issues ever mentions agents, skills, LangGraph or why the user vs. an agent does a task | Writing issues in the user's language or mentioning agents/git permissions in issues and workspace files |

## Deferred to the workspace

These are defects in `ibid-workspace` itself. Each becomes a user story once the system runs.

| Defect | Rule |
| --- | --- |
| Module boundaries allow every project to depend on every other | W01, W02 |
| No style checker is installed | W12, W25, W26, O08 |
| `eslint.config.mjs` carries a comment | W22 |
| No rule sets `no-explicit-any` explicitly | W17 |

## Open

| Question | Why it matters |
| --- | --- |
| `papikapi-api` has no rule file | It cannot get a specialist until its rules are written |
| `libs/testing` and `libs/utils` declare no targets in `project.json` | Their checks must be confirmed from the inferred targets |
| An older note allows a header comment at the top of a file or class; the workspace rule bans every comment | LangGraph currently fails every comment except `secretlint-disable` |
| The visual gate depends on the scripts of the `visual-qa` skill, which still live outside this repository | They must be moved here, and the user has so far reserved running figure scripts to himself |
| The Angular skill, Modern Web Guidance and the Playwright test agents are named in contracts but not installed | The contracts point at references that are not on disk yet |
| `design-system-specialist` asks for 12 to 20 changed files per step | Dropped: the plan decides the files; to confirm |
