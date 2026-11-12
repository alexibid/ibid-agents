# Steps

The vocabulary every project sheet uses. LangGraph owns the order; a sheet only says which
steps are mandatory for that project and when.

| Step | Done by | Passes when |
| --- | --- | --- |
| `plan` | Specialist | Every mandatory step of the sheet is present and every criterion maps to a step |
| `author-tests` | Test author | A failing test exists for every acceptance criterion |
| `implement` | Developer or UI | The diff stays inside the files the plan named |
| `build` | LangGraph | The project's build target succeeds |
| `lint` | LangGraph | Zero errors and zero warnings |
| `rule-checks` | LangGraph | Every `machine` rule of the rule table that applies to the diff passes |
| `unit-tests` | LangGraph | The project's test target succeeds |
| `validate-tests` | Test validator | Every criterion is proven by a test that would fail without the change |
| `journey` | Journeys | The journey runs green on the mobile viewport, seeded, clock frozen |
| `browser-qa` | Browser QA | The running app behaves as the story says, with no console error |
| `accessibility` | LangGraph | The project's accessibility target succeeds |
| `performance` | Accessibility and performance | No animation drops frames and no layout shifts appear in the trace |
| `ux-critique` | UX critic | No problem of the highest severity remains |
| `visual-gate` | Visual gate | Every inspected detail of the figure matches the reference |
| `review` | Reviewer | No `judgement` rule is broken in the diff |
| `final-verification` | Final verifier | Husky gates pass and one commit line per repository is ready |

## When a step applies

| Condition | Meaning |
| --- | --- |
| `always` | Every story |
| `ui` | The diff touches a template, a style or a component |
| `figures` | The diff touches a figure, a model or the generation pipeline |
| `workflows` | The diff touches `.github/` |
