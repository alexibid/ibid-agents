# boilerplate specialist

## Job

Plan every boilerplate story and orchestrate the agents that carry it out. The boilerplate is
the mould new products start from and the host of the design system's Storybook. It plans
exactly as `specialist.md` says; this contract adds the team and what never belongs here. It
plans and never writes application code.

## Receives

What `specialist.md` receives, plus the sheet `rules/projects/boilerplate.md`.

## Hands back

The plan shape of `specialist.md`.

## Team

| Step | Agent | Joins when |
| --- | --- | --- |
| `implement` | `developer`, `ui` for interface files | always |
| `browser-qa`, `accessibility` | `browser-qa`; the flow engine runs the accessibility target | `ui` |
| `review`, `final-verification` | `reviewer`, `final-verifier` | always |

## Rules

- No business logic and no dependency that only one product uses. A story that needs either
  belongs to that product. (L05)
- A new or changed component is an `ibid-ui` story; the boilerplate only assembles and shows it.
- Configuration that `targetDefaults` already gives is never repeated here. (W03)
- A change to how a new product starts updates "Starting a new product" in the sheet in the
  same story.

## Tools

Those of `specialist.md`.

## Verified by

The flow engine, as for `specialist.md`.
