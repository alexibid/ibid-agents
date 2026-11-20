# Steps

The vocabulary every project sheet uses. The flow engine owns the order; a sheet only says which
steps are mandatory for that project and when.

| Step | Done by | Passes when |
| --- | --- | --- |
| `plan` | Specialist | Every mandatory step of the sheet is present and every criterion maps to a step |
| `author-tests` | Test author | A failing test exists for every acceptance criterion |
| `implement` | Developer or UI | The diff stays inside the files the plan named |
| `build` | Flow engine | The project's build target succeeds |
| `lint` | Flow engine | Zero errors and zero warnings |
| `rule-checks` | Flow engine | Every `machine` rule of the rule table that applies to the diff passes |
| `unit-tests` | Flow engine | The project's test target succeeds |
| `validate-tests` | Test validator | Every criterion is proven by a test that would fail without the change |
| `journey` | Journeys | The journey runs green on the mobile viewport, seeded, clock frozen |
| `browser-qa` | Browser QA | The running app behaves as the story says, with no console error |
| `accessibility` | Flow engine | The project's accessibility target succeeds |
| `performance` | Accessibility and performance | No animation drops frames and no layout shifts appear in the trace |
| `ux-critique` | UX critic | No problem of the highest severity remains |
| `visual-gate` | Visual gate | Every inspected detail of the figure matches the reference |
| `review` | Reviewer | No `judgement` rule is broken in the diff |
| `final-verification` | Final verifier | Husky gates pass and one commit line per repository is ready |

A failed `validate-tests` goes back to `author-tests`, whose tests prove too little, or to
`implement` when the project has no `author-tests` step. `author-tests`, `implement` and
`final-verification` repeat themselves; any other failed step goes back to `implement`.

A hand-back that does not have the shape the instruction asks for is not judged: the flow
engine asks for the same step again and counts it apart from the failed attempts of the work.

## When a step applies

| Condition | Meaning |
| --- | --- |
| `always` | Every story |
| `ui` | The diff touches a template, a style or a component |
| `figures` | The diff touches a file the project sheet lists under `figures` in its "Triggers" table (today only `papikapi` and `papikapi-studio`) |
| `workflows` | The diff touches `.github/` |

A condition exists only in a project whose sheet gives it a step under "Mandatory steps".
The files that trigger `ui` and `workflows` are the same in every project; a project adds its
own triggers in the "Triggers" table of its sheet.

## Follow-ups

Any hand-back, the plan included, may add `followUps`: work outside the story worth doing later,
such as a document gone stale. The flow engine also keeps the review findings that do not block
and the medium and low UX findings. A finished story reports them all once, and the assistant
hands them to the project manager, who files them in the backlog.

