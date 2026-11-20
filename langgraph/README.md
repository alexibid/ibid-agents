# langgraph

The program that owns the order of the work. It hands out one step at a time, verifies what
comes back, runs its own checks, and only then gives the next step. It never writes code.

The flow engine, implemented here with LangGraph. Claude and Antigravity reach it as an MCP server, so both follow the same
steps and face the same checks.

## Tools it offers

| Tool | Use |
| --- | --- |
| `start_story` | Start an approved user story. Returns the story id and asks for a plan |
| `submit_plan` | Hand in the specialist's plan. A rejected plan returns the problems |
| `submit_step` | Hand in the result of the current step. Returns the next step or the exact failure |
| `story_status` | Read where a story stands |

## How a story moves

1. `start_story` records which files were already changed, so earlier work is never blamed on
   the story.
2. The plan is accepted only when it names its files, declares what they trigger, names a
   journey when one is mandatory, and lists the parts of the libraries under the sheet's `Reuses`
   considered when it touches the interface.
3. The mandatory steps of the project sheet that match the plan become the queue, in the order
   of `rules/steps.md`.
4. A step done by an agent pauses the flow until its evidence arrives. A step done by the
   program runs at once.
5. After `implement`, the files that really changed are compared with the plan. Changes outside
   it fail the step, and changes that trigger more conditions add their steps to the queue.
6. A failed step sends the work back to `implement` with the failure. Three failures of the
   same step stop the story and hand it to the user.

## The graph

Every step is its own node, so the drawing shows the real path of a story. `intake` reads the
project sheet and records which files were already changed. `planning` waits for the plan. Each
step node then either waits for an agent's evidence or runs its own check, and the edge it
takes depends on the result: forward to the next step in the queue, back to `implement` after a
failure, or to the end.

The drawing generated from the code is in `docs/flow.md`.

## Seeing it in Studio

```bash
npm run studio
```

This starts a local server on port 2024 and opens LangSmith Studio in the browser, connected to
it. Studio shows the graph, lets a story be started by hand, and shows the state after each
node. The graph is registered as `ibid`; a story is started with an input such as
`{ "story": { "project": "papikapi", "title": "...", "criteria": ["..."] } }`.

Studio keeps its own stories. It does not show the ones Claude or Antigravity started, which
live in `state/stories.sqlite`.

## What it checks by itself

| Step | Check |
| --- | --- |
| `build`, `lint`, `unit-tests`, `journey`, `accessibility` | The command from the project sheet |
| `rule-checks` | W09 native elements outside atoms, W13 file length, W22 comments, W24 design tool names |
| `final-verification` | One commit line per changed repository, `commitlint` on each line, `secretlint` on the changed files; then it writes the `git add` and `git commit` command for each repository, staging only the story's own files |

The other `machine` rules of `rules/rule-table.md` are not implemented yet.

## Configuration

| Variable | Meaning | Default |
| --- | --- | --- |
| `IBID_WORKSPACE_ROOT` | Absolute path of `ibid-workspace` | Required |
| `IBID_PROJECT_SHEETS` | Folder holding the project sheets | `../rules/projects` |
| `IBID_AGENT_CONTRACTS` | Folder holding the agent contracts | `../agents` |
| `IBID_LANGGRAPH_STATE` | SQLite file that keeps every story | `state/stories.sqlite` |

## Commands

| For | Command |
| --- | --- |
| Compile | `npm run build` |
| Unit tests | `npm test` |
| Run as a server | `npm start` |
| Open Studio | `npm run studio` |

## Layout

| Folder under `src/` | Holds |
| --- | --- |
| `domain/` | Steps, sheets and plans. No dependency on LangGraph or MCP |
| `sheets/` | Reads a project sheet from its markdown tables |
| `checks/` | Commands, changed files and rule checks |
| `flow/` | The flow graph, its state, the evidence judges and the instructions |
| `story-flow.ts` | Starts stories and resumes them |
| `server.ts` | The MCP server |
| `studio.ts` | The graph as Studio loads it |
| `configuration.ts` | Paths read from the environment |
| `guard/`, `guard.ts` | The hook that denies forbidden commands and writes in both tools |
