# papikapi-studio

3D generation and papercraft unfolding studio. Its rules also bind `papikapi` wherever figures
are involved.

| Field | Value |
| --- | --- |
| Path | `apps/papikapi-studio` |
| Nx project | `papikapi-studio` |
| Prefix | `papikapi-studio-` |
| Commit scope | `papikapi-studio` |
| Delivery | Web. Never reaches a phone |

## Mandatory steps

| Step | When |
| --- | --- |
| `plan`, `implement`, `build`, `lint`, `rule-checks`, `review`, `final-verification` | `always` |
| `browser-qa`, `ux-critique` | `ui` |
| `visual-gate` | `figures` |

The project declares no test target today. `author-tests`, `unit-tests` and `validate-tests`
become mandatory once it has one.

## Checks

| Step | Command |
| --- | --- |
| `build` | `npx nx build papikapi-studio` |
| `lint` | `npx nx lint papikapi-studio` |

## Generation prompts

- The user prompt carries only the subject: identity, species, colours and markings, taken
  from the reference image first.
- Stance, plinth, background, facets, shadows, camera and child-safety constraints live in the
  system prompt.
- `scripts/common/prompt-guard.ts` enforces the separation and
  `scripts/common/prompt-enricher.spec.ts` tests it. (P05)

## Visual gate

- The whole figure is inspected through 360 degrees: eyes, pupils and catchlights; muzzle,
  nose, lips; facial markings and ears; chest, belly, back and tail; each of the four paws.
- One failing, blurred, bleeding or missing detail rejects the figure. (S01)
- A verdict is valid only when the rendered image was inspected in the same step. (S02)
- The agent that produced the figure never judges it. (S03)
