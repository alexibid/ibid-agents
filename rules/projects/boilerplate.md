# boilerplate

Not a product. It is the mould new products start from, and the host of the design system
Storybook.

| Field | Value |
| --- | --- |
| Path | `apps/boilerplate` |
| Nx project | `boilerplate` |
| Prefix | `boilerplate-` |
| Commit scope | `boilerplate` |

## Mandatory steps

| Step | When |
| --- | --- |
| `plan`, `implement`, `build`, `lint`, `rule-checks`, `unit-tests`, `review`, `final-verification` | `always` |
| `browser-qa`, `accessibility` | `ui` |

## Checks

| Step | Command |
| --- | --- |
| `build` | `npx nx build boilerplate` |
| `lint` | `npx nx lint boilerplate` |
| `unit-tests` | `npx nx test boilerplate` |
| `accessibility` | `npx nx test-a11y boilerplate` |
| `browser-qa` | `npx nx build-storybook boilerplate` |

## What it demonstrates

| Inherited | Where it shows |
| --- | --- |
| Build engine | `project.json` declares only styles and budgets |
| Compiler base | `tsconfig.json` extends `tools/builder/tsconfig.app.base.json` and adds only its own `paths` |
| Design system | `app.html` assembles the shell from `ibid-header` and `ibid-header-nav` |

## What never belongs here

- Business logic from any product. (L05)
- Configuration that already comes from `targetDefaults` in `nx.json`. (W03)
- A dependency only one product uses. (L05)

## Starting a new product

1. Copy `apps/boilerplate` to `apps/<new-product>`.
2. In `project.json`, change `name`, `prefix` and the `styles` list.
3. In `tsconfig.json`, adjust `paths` to the new product's layers.
4. In `eslint.config.mjs`, set the selector prefix to the new product's name.
5. Add `rules/projects/<new-product>.md` in `ibid-agents`.
6. Confirm with `npx nx build <new-product>` before the first feature.
