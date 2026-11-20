# Project scope audit of the story flow

Generalist steps and contracts apply to every project, inside the workspace or outside it.
A rule that belongs to one project lives in that project's sheet (`rules/projects/<project>.md`).
This lists every place where the shared flow applied a project's rule as if it were general,
and where each one lives now.

## Moved to the project sheets

| Case | Was | Now |
| --- | --- | --- |
| `figures` detection | `domain/plan.ts` matched `.glb`, `figures/` and any `models/` folder in every project | `## Triggers` table in `papikapi.md` and `papikapi-studio.md`: `.glb`, `.gltf`, `.blend`, `.obj`, `figures/`. `models/` is gone |
| Conditions in general | Any detected condition was required, even in a project with no step for it | A condition counts only when the sheet gives it a step (`conditionsUsedBy`) |
| `ibid-ui` reuse search (W10) | Every `ui` plan had to list `ibid-ui` parts, ibid-website included | `Reuses` field; only sheets that name it ask for `reusedParts` |
| Native element check (W09) | `rule-checks` banned native `button`, `input`, `select`, `dialog` everywhere | Runs only for sheets that name `Reuses`; ibid-website allows them |
| Plan hand-back shape | Listed `figures` and `<ibid-ui part>` for every project | Built from the sheet: its conditions and its `Reuses` |
| Selector prefixes | Table of every project's prefix in `rules/core.md` | The `Prefix` field each sheet already had |
| Commit scopes | Fixed list of projects in `agents/final-verifier.md` | The `Commit scope` field of the sheet |
| `ibid-ui` wording in contracts | `specialist.md`, `ui.md`, `reviewer.md`, `rule-table.md`, `steps.md` | Refer to the sheet's `Reuses` and `Triggers` |

## Fixed for projects outside the workspace (ibid-agents)

| Case | Fix |
| --- | --- |
| Change tracking saw only the workspace root and its submodules | A sheet whose `Path` starts with `../` adds that repository to the tracked ones |
| `nx sync:check` and the `nx.md` contract fired on any `package.json` | Files outside the workspace are not Nx workspace files |
| Final verification asked for a workspace root line when any non-root repository changed | Only a submodule requires the root line |
| Handover staged every non-root repository as a submodule pointer | Repositories outside the workspace are never staged at the root |

## Kept general on purpose

| Case | Why |
| --- | --- |
| `ui` triggers (`.html`, `.scss`, `.css`, `.svg`, `.stories.ts`, `ui/`, `atoms/`, `molecules/`, `organisms/`, `templates/`) | Every Angular project in the workspace follows these layers. They still count only where the sheet has a `ui` step |
| `workflows` trigger (`.github/`) | Same in every repository. No sheet gives it a step today |
| W13, W22, W24 rule checks | Workspace-wide code rules |
| `visual-gate` step, contract and evidence judge | Generic step vocabulary; only sheets with `figures` steps ever queue it |
| Guard on `serve` and `storybook` commands | Protects every project's reserved ports, not one project |
| Commitlint and secretlint commands | Workspace gates; `config-conventional` accepts any scope |
| Monitor ports `4710` and `4711`, `tauri://` origins | Belong to the LangGraph monitor itself, not to a story project |
| Coach default workspace (`lemon-mart`) | The coach is its own flow, separate from stories |

## Open points

- The generation pipeline lives in `papikapi-api`, whose sheet now lists `blender/` and
  `public/models/` as `figures` triggers; `papikapi-studio.md` points to its `prompt-guard.ts`.
- `rule-table.md` W11 still states that a new element is born in `ibid-ui`. It holds for the
  sheets that name `Reuses`, and has no automated check.
