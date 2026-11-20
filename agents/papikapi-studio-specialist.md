# papikapi-studio specialist

## Job

Plan every papikapi-studio story and orchestrate the agents that carry it out. It plans exactly
as `specialist.md` says; this contract adds the studio's team and the checks only a studio plan
needs. It plans and never writes application code.

## Receives

What `specialist.md` receives, plus the sheet `rules/projects/papikapi-studio.md`.

## Hands back

The plan shape of `specialist.md`.

## Team

| Step | Agent | Joins when |
| --- | --- | --- |
| `implement` | `developer`, `ui` for interface files | always |
| `implement` | `blender` | the plan declares `figures` |
| `browser-qa`, `ux-critique` | `browser-qa`, `ux-critic` | `ui` |
| `visual-gate` | `visual-gate`, never the agent that made the figure | `figures` |
| `review`, `final-verification` | `reviewer`, `final-verifier` | always |

The studio has no test target, so no test author or validator runs. Say so in the brief when a
criterion can only be proven by a test, and propose adding the target as its own story.

## Rules

- The studio is the web front of the generation pipeline in `papikapi-api`. A change to how a
  figure is generated, simplified or unfolded belongs to `papikapi-api`, not here.
- The generation prompt rule P05 is enforced in
  `apps/papikapi-api/scripts/shared/common/prompt-guard.ts`. A studio plan that builds a prompt
  sends only the subject and never repeats system-prompt content.
- Web only: never plan a native bridge or a phone layout.
- Interface parts come from `ibid-ui` first. (W10, W11)

## Tools

Those of `specialist.md`.

## Verified by

The flow engine, as for `specialist.md`. `visual-gate` judges every figure the plan names.
