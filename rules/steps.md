# Steps

The vocabulary every project sheet uses. The flow engine owns the order; a sheet only says which
steps are mandatory for that project and when.

A story runs in two phases. **Building** runs `plan`, `implement` (developer and UI),
`author-tests`, `build` and `lint`, then stops as `ready-for-commit`. **Commit** starts only when
the user asks to commit (`advance_to_commit`) and runs everything else: rule checks, unit tests,
test validation, journeys, browser QA, accessibility, performance, UX, visual gate, review and
final verification. Tests are written while building but run and judged only at the commit. On a
repair of the code `author-tests` passes as skipped: the tests already written stay, and the test
author runs again only when the unit tests or the validator find a problem in them.

Any agent may hand back `questions` instead of guessing. The story then stops as `needs-user`
without spending an attempt, and `resume_story` with the user's decision adds it to the brief.

| Step | Done by | Passes when |
| --- | --- | --- |
| `plan` | Specialist | Every mandatory step of the sheet is present and every criterion maps to a step |
| `author-tests` | Test author | Right after the developer: the fewest tests that prove each criterion, at the lowest layer; on a test failure, only what failed is fixed |
| `implement` | Developer or UI | The diff stays inside the files the plan named |
| `build` | Flow engine | The project's build target succeeds |
| `lint` | Flow engine | Zero errors and zero warnings |
| `rule-checks` | Flow engine | Every `machine` rule of the rule table that applies to the diff passes |
| `unit-tests` | Flow engine | The project's test target succeeds |
| `validate-tests` | Test validator | At the commit: every criterion is proven, once and at the right layer, by a mocked test that would fail without the change, and the changed logic is covered at 75-85% |
| `journey` | Journeys | The critical journey runs green on the mobile viewport, on mocked data, clock frozen |
| `browser-qa` | Browser QA | The running app behaves as the story says, with no console error |
| `accessibility` | Flow engine | The project's accessibility target succeeds |
| `performance` | Accessibility and performance | No animation drops frames and no layout shifts appear in the trace |
| `ux-critique` | UX critic | No problem of the highest severity remains |
| `visual-gate` | Visual gate | Every inspected detail of the figure matches the reference |
| `review` | Reviewer | No `judgement` rule is broken in the diff |
| `final-verification` | Final verifier | Husky gates pass and one commit line per repository is ready |

A failed `unit-tests` or `validate-tests` goes back to `author-tests`, who wrote the tests after
the change, or to `implement` when the project has no `author-tests` step. `author-tests`,
`implement` and `final-verification` repeat themselves; any other failed step goes back to
`implement`.

After `implement`, the flow engine replans the conditional steps from the files the change really
touched: a condition the plan declared but the change does not trigger drops its steps. A step that
looks at the screen (`browser-qa`, `accessibility`, `performance`, `ux-critique`, `visual-gate`)
that already passed runs again only when a file that triggers its condition changed since; otherwise
it passes as skipped.

A story that stopped as `needs-user` continues with `resume_story` once the user has decided,
at the step that failed and with fresh attempts.

A hand-back that does not have the shape the instruction asks for is not judged: the flow
engine asks for the same step again and counts it apart from the failed attempts of the work.

## When a step applies

| Condition | Meaning |
| --- | --- |
| `always` | Every story |
| `ui` | The diff touches something visual: `.html`, `.scss`, `.css` or `.svg` |
| `behaviour` | The diff touches screen code that is not visual: files under `ui/`, `pages/` and the atomic folders, routes, directives, pipes and guards |
| `figures` | The diff touches a file the project sheet lists under `figures` in its "Triggers" table (today only `papikapi` and `papikapi-studio`) |
| `workflows` | The diff touches `.github/` |

A condition exists only in a project whose sheet gives it a step under "Mandatory steps".
The files that trigger `ui`, `behaviour` and `workflows` are the same in every project; a project
adds its own triggers in the "Triggers" table of its sheet. Tests, mocks and Storybook stories never
trigger a condition.

## Follow-ups

Any hand-back, the plan included, may add `followUps`: work outside the story worth doing later,
such as a document gone stale. The flow engine also keeps the review findings that do not block
and the medium and low UX findings. A finished story reports them all once, and the assistant
hands them to the project manager, who files them in the backlog.

