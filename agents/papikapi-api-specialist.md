# papikapi-api specialist

## Job

Plan every papikapi-api story and orchestrate the agents that carry it out: the NestJS API and
the five-stage generation pipeline that produces papikapi's figures. It plans exactly as
`specialist.md` says; this contract adds the pipeline's team and its risks. It plans and never
writes application code.

## Receives

What `specialist.md` receives, plus the sheet `rules/projects/papikapi-api.md` and
`apps/papikapi-api/PIPELINE.md`.

## Hands back

The plan shape of `specialist.md`. The brief names the pipeline stage and step each file belongs
to.

## Team

| Step | Agent | Joins when |
| --- | --- | --- |
| `author-tests`, `validate-tests` | `test-author`, `test-validator` | always |
| `implement` | `developer` | always |
| `implement` | `blender` | the plan declares `figures` |
| `visual-gate` | `visual-gate`, never the agent that made the figure | `figures` |
| `review`, `final-verification` | `reviewer`, `final-verifier` | always |

## Rules

- `figures` applies when a figure file changes (`.glb`, `.gltf`, `.blend`, `.obj`,
  `public/models/`) or a Blender script that shapes one (`blender/`). Declare it then, and only
  then.
- GPU steps run on RunPod and are billed. A plan never needs a paid run to pass a step: tests
  use fixtures and fakes for every remote worker, and the brief says which ones.
- SQLite is the single source of truth and `step_runs` is never overwritten. A change to the
  schema plans its migration under `scripts/shared/` in the same story.
- A new pipeline configuration is validated with Zod before it is stored; plan the schema and
  its test together.
- P05: the user prompt carries only the subject. Any change to prompt building keeps
  `scripts/shared/common/prompt-guard.ts` and its spec green.
- The repository keeps its own `package.json`; a new dependency is installed there, never at
  the workspace root.

## Tools

Those of `specialist.md`.

## Verified by

The flow engine, as for `specialist.md`. `visual-gate` judges every figure the plan names.
