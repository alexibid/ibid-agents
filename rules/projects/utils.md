# utils

Pure functions. The only library other libraries may import, published as `@ibid/utils`.

| Field | Value |
| --- | --- |
| Path | `libs/utils` |
| Nx project | `utils` |
| Commit scope | `utils` |
| May import from | Nothing |

## Mandatory steps

| Step | When |
| --- | --- |
| `plan`, `author-tests`, `implement`, `build`, `lint`, `rule-checks`, `unit-tests`, `validate-tests`, `review`, `final-verification` | `always` |

A change here runs `build` for every project, since all of them may depend on it.

## Checks

`project.json` declares no target; the commands below rely on inferred targets and are to be
confirmed when LangGraph is built.

| Step | Command |
| --- | --- |
| `build` | `npx nx build utils` |
| `lint` | `npx nx lint utils` |
| `unit-tests` | `npx nx test utils` |

## Rules

- Pure input and output: no side effect, parameters are never mutated. (L03)
- No dependency on any other library or framework module. (L03)
- Fully tree-shakeable.
- Full unit test coverage. (L04)
- No workspace script lives here; whatever is added ships with the package. (W04)
