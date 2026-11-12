# ibid-ui

The shared design system. Every app consumes it.

| Field | Value |
| --- | --- |
| Path | `libs/ibid-ui` |
| Nx project | `ibid-ui` |
| Prefix | `ibid-` for components, directives and pipes |
| Commit scope | `ibid-ui` |
| May import from | `libs/utils` and Angular packages |

## Mandatory steps

| Step | When |
| --- | --- |
| `plan`, `author-tests`, `implement`, `build`, `lint`, `rule-checks`, `unit-tests`, `validate-tests`, `review`, `final-verification` | `always` |
| `browser-qa`, `accessibility`, `performance`, `ux-critique` | `ui` |

A change here also runs `build` for every app that consumes the changed component.

## Checks

| Step | Command |
| --- | --- |
| `build` | `npx nx build ibid-ui` |
| `lint` | `npx nx lint ibid-ui` |
| `unit-tests` | `npx nx test ibid-ui` |
| `accessibility` | `npx nx test-a11y boilerplate` |
| `browser-qa` | `npx nx build-storybook boilerplate`, then the story is opened |

`ibid-ui` has no accessibility target of its own. The boilerplate showcase hosts its components,
so its target stands in; whether it reaches every changed component is to be confirmed.

## Structure

| Folder under `src/lib/` | Holds |
| --- | --- |
| `atoms/` | The lowest-level wrappers: button, input, icon, chip, scrim, textarea |
| `molecules/` | Simple compositions of atoms |
| `organisms/` | Complex widgets |
| `templates/` | Layout frames |
| `styles/` | ITCSS layers and tokens |

## Rules

- Anything two apps need, or one app needs as a primitive, belongs here. (W11)
- Raw `button`, `input`, `select` and `dialog` exist only inside their atom. (W09)
- An atom gains a capability through an optional input, leaving existing callers
  untouched. (U02)
- Every component has a story and a spec in its own folder. (W11)
- A story uses the minimal form; Compodoc supplies documentation and `argTypes`.
- When a component moves here from an app, its selector takes the `ibid-` prefix.

## Styles

Global SCSS under `src/styles/`, by increasing specificity: `settings`, `tools`, `generic`,
`elements`, `objects`, `components`, `trumps`. `tools` never emits CSS. Overrides exist only
in `trumps`.
