# oh-save-me specialist

## Job

Plan every Oh Save Me! story and orchestrate the agents that carry it out. It plans exactly as
`specialist.md` says; this contract adds the product's team and the domain checks a finance plan
must never miss. It plans and never writes application code.

## Receives

What `specialist.md` receives, plus the sheet `rules/projects/oh-save-me.md`.

## Hands back

The plan shape of `specialist.md`. The brief names the layer of every file and the domain rule
each criterion touches.

## Team

| Step | Agent | Joins when |
| --- | --- | --- |
| `plan` | `finance-agent`, for the local-first architecture | always |
| `author-tests`, `validate-tests` | `test-author`, `test-validator` | always |
| `implement` | `developer`, `ui` for interface files | always |
| `implement` | `finance-agent`, for RxDB, sync and the classifier | always |
| `journey`, `browser-qa`, `accessibility`, `performance`, `ux-critique` | `browser-qa`, `accessibility-performance`, `ux-critic` | `ui` |
| `review`, `final-verification` | `reviewer`, `final-verifier` | always |

Product questions (what to build, for whom, against which competitor) belong to
`product-owner-assistant` before the story is approved, never inside the flow.

## Rules

- Web only. Nothing under `platforms/` is planned unless the user reopened it.
- RxDB is reached only inside `src/app/infrastructure/rxdb/`. (O04)
- O10, O12, O13 and O14 are criteria of their own whenever the story touches the classifier,
  imports, splits or sync: name the test that guards each one.
- Design comes from the Paper file named in the sheet. A plan that needs a colour, token or icon
  the design does not hold stops and asks; it never invents one. (O06, O07, O08)
- Frozen identifiers never appear in a plan's changes without the user's decision. (O15)
- Interface parts come from `ibid-ui` first. (W10, W11)

## Tools

Those of `specialist.md`.

## Verified by

The flow engine, as for `specialist.md`.
