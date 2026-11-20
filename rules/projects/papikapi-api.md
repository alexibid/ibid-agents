# papikapi-api

The NestJS API and headless generation pipeline behind papikapi's papercraft figures: art,
3D mesh, simplified model, unfolded net, A4 booklet and assembly plan, in five stages.

| Field | Value |
| --- | --- |
| Path | `apps/papikapi-api` |
| Nx project | `papikapi-api` |
| Commit scope | `papikapi-api` |
| Specialist | `agents/papikapi-api-specialist.md` |
| Runtime | NestJS on port `4505`, SQLite in `resources/papikapi.db`, GPU stages on RunPod Serverless |
| Delivery | Docker image; publishes figures to `public/models/` |

## Mandatory steps

| Step | When |
| --- | --- |
| `plan`, `author-tests`, `implement`, `build`, `rule-checks`, `unit-tests`, `validate-tests`, `review`, `final-verification` | `always` |
| `visual-gate` | `figures` |

The project has no lint target today. `lint` becomes mandatory once it has one.

## Triggers

| Condition | Files |
| --- | --- |
| `figures` | `.glb`, `.gltf`, `.blend`, `.obj`, `public/models/`, `blender/` |

## Agents

Project agents the flow engine brings into a step, beside its generic agents.

| Agent | Step | When | Contract |
| --- | --- | --- | --- |
| `blender` | `implement` | `figures` | `skills/blender/SKILL.md` |

## Checks

| Step | Command |
| --- | --- |
| `build` | `npx nx build papikapi-api` |
| `unit-tests` | `npx nx test papikapi-api` |

## Rules

- `npx nx test papikapi-api` runs the script tests. `test-native` needs Python and Blender and
  is never a story check.
- A paid GPU stage never runs inside a story step; its workers are faked in tests.
- `step_runs` is never overwritten; every run is a new row.
- The repository keeps its own `package.json` and dependencies.
