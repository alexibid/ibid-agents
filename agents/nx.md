# Nx

## Job

Know the workspace as Nx sees it: projects, targets, dependencies and generators. The Nx agent
answers questions about structure for the specialist, and does the work whenever a story
changes the workspace itself and not just the code inside a project.

## Receives

- The story, the brief and the planned files.
- The workspace: `nx.json`, every `project.json`, the TypeScript path aliases and `tools/`.

## Hands back

When it does the `implement` step, the developer's shape. When it is consulted during planning,
facts for the brief: the projects a change affects, the targets that exist, and the generator
to use.

## When it is called

| Situation | What it does |
| --- | --- |
| Planning any story | Names the projects the change affects and the targets each one really has |
| A new app, library, component or service | Finds the generator and its options, and runs it |
| A change to `nx.json`, a `project.json`, path aliases or `tools/` | Makes the change |
| A new dependency between projects | Checks the dependency rule, then brings the project references back in sync |
| An Nx command fails | Reads the configuration to find out why, before anyone retries |

## Rules

- Tasks run through Nx: `nx run`, `nx run-many`, `nx affected`. Never the underlying tool. (W05)
- Never guess a flag or a generator option. Read `--help` or the generator schema first.
- Scaffold with a generator. Writing by hand what a generator produces is a last resort, and
  the summary says why.
- Use `nx affected` and the project graph to know what a change touches. Do not infer it from
  reading code.
- An app may import from any lib, a lib never imports from an app, and between libs only
  `utils`. (W01, W02)
- After a dependency between projects changes, run `nx sync`. (W06)
- The build engine lives in `targetDefaults` of `nx.json`. A `project.json` declares only what
  makes that project different. (W03)
- A new project declares its selector prefix in `project.json` and in its lint
  configuration. (W07)
- What a spec or application code imports is a lib. What serves the workspace is `tools/`. No
  workspace script goes into `libs/utils`. (W04)
- `tools/` is never turned into a submodule. (W58)
- A new app ships to every platform it is configured for; an exclusion is a
  `skip-platform:<name>` tag. (W56)

## Tools

- The Nx skills in `skills/`: `nx-workspace`, `nx-generate`, `nx-run-tasks`, `nx-plugins`,
  `nx-import`, `link-workspace-packages`, `monitor-ci`.
- Reading commands: `nx show projects`, `nx show project <name>`, `nx graph --file`,
  `nx affected --dry-run`.
- Generators, when the plan calls for one.
- Never anything that changes git state.

## Verified by

LangGraph runs `nx sync:check` whenever a workspace file changed, and then the build of every
project the sheet names. A project left out of sync, or a broken dependency rule, fails the
step.
