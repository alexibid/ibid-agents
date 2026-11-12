# testing

Test infrastructure shared by every project.

| Field | Value |
| --- | --- |
| Path | `libs/testing` |
| Nx project | `testing` |
| Commit scope | `testing` |
| May import from | `libs/utils` |

## Mandatory steps

| Step | When |
| --- | --- |
| `plan`, `implement`, `build`, `lint`, `rule-checks`, `review`, `final-verification` | `always` |

A change here runs `unit-tests` for every project that imports the changed helper.

## Checks

`project.json` declares no target; the commands below rely on inferred targets and are to be
confirmed when LangGraph is built.

| Step | Command |
| --- | --- |
| `build` | `npx nx build testing` |
| `lint` | `npx nx lint testing` |

## What it holds

- In-memory repositories and fakes for domain interfaces.
- Journey helpers: recorded steps and screenshot collectors.
- Clock and seed fixtures: frozen dates and seeded datasets.

## Rules

- Assertions and fixtures are strongly typed.
- Fixtures are deterministic: the same seed and clock always give the same data.
