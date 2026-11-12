# Rule table

Every rule found in the workspace and project rule files on 2026-11-11, deduplicated, with the
way it will be guaranteed.

## Reading the table

| Kind | Meaning | Guarantee |
| --- | --- | --- |
| `machine` | A program can verify it | Full: LangGraph runs the check |
| `guard` | A forbidden action | Full: a hook denies it when attempted |
| `process` | Step order or required evidence | Full: LangGraph owns it |
| `judgement` | Needs reading and thinking | Partial: reviewer or UX critic, then code review |

`Today` says whether anything other than the model's memory enforces the rule now.

## Workspace

| Id | Rule | Kind | Today | How it is guaranteed |
| --- | --- | --- | --- | --- |
| W01 | A lib never imports from an app | machine | no | Tag projects `type:app` and `type:lib`; set `depConstraints` |
| W02 | Between libs the only allowed dependency is `utils` | machine | no | Tag `scope:utils`; set `depConstraints` |
| W03 | An app's `project.json` declares only what differs from `targetDefaults` | judgement | no | Reviewer |
| W04 | `libs/utils` holds no workspace scripts | judgement | no | Reviewer |
| W05 | Tasks run through Nx, never the underlying tool | guard | no | Deny direct `vitest`, `playwright`, `ng`, `tsc` commands |
| W06 | `nx sync` after changing project dependencies | machine | no | LangGraph runs `nx sync:check` |
| W07 | Component and directive selectors carry the project prefix; `app-` is banned | machine | yes | `@angular-eslint` selector rules |
| W08 | Pipes carry the project prefix | machine | no | Add `@angular-eslint/pipe-prefix` |
| W09 | Native `button`, `input`, `select`, `dialog` only inside the atom that wraps them | machine | no | Template scan outside `atoms/` |
| W10 | Look in `ibid-ui` before writing any interface element | process | no | The plan must list the `ibid-ui` parts considered |
| W11 | A new element is born in `ibid-ui`, with a story and a spec | machine | no | Sibling `.stories.ts` and `.spec.ts` check |
| W12 | Tokens and mixins instead of literal values | machine | no | Stylelint strict-value |
| W13 | Files of at most 300 lines | machine | no | ESLint `max-lines`, plus a scan for templates and styles |
| W14 | Small functions, one responsibility, one level of abstraction | judgement | no | Reviewer |
| W15 | At most three arguments | machine | no | ESLint `max-params` |
| W16 | No flag arguments | judgement | no | Reviewer |
| W17 | Never `any` | machine | unverified | Set `no-explicit-any` to error explicitly |
| W18 | Prefer `readonly` | judgement | no | Reviewer |
| W19 | No numeric enums | machine | no | ESLint `no-restricted-syntax` on enum declarations |
| W20 | Type guards instead of assertions | machine | no | ESLint `consistent-type-assertions` |
| W21 | No `null` or `undefined` returned or passed when avoidable; errors are thrown | judgement | no | Reviewer |
| W22 | No comments in source or tests | machine | no | Comment scan |
| W23 | A lint rule wanting a non-empty block is configured, not silenced with a comment | machine | yes | `no-empty` and `no-empty-function` configuration |
| W24 | Source never names design tools | machine | no | Word scan |
| W25 | ITCSS layer order; no override outside `trumps` | machine | no | Stylelint `declaration-no-important` outside `trumps`, import-order scan |
| W26 | BEM class names; no deep nesting | machine | no | Stylelint `selector-class-pattern`, `max-nesting-depth` |
| W27 | A spec exists for every component, service, use case and repository | machine | no | Sibling spec check |
| W28 | Tests are written before or alongside the code | process | no | Test author works from the story before the developer |
| W29 | All business logic is covered | machine | no | Coverage threshold on domain and application layers |
| W30 | A changed UI component has an updated story | machine | no | Diff check: component changed implies story changed or present |
| W31 | Journeys run on the mobile viewport, seeded, clock frozen | machine | no | Journey config scan |
| W32 | Journeys cover open, interact, dialogs, submit and persistence after reload | judgement | no | Test validator |
| W33 | Every journey transition records `recorder.step` | machine | no | Journey scan |
| W34 | No watch mode; a server never uses a port the workspace reserves | guard | no | Deny watch flags, and any server that names no port or names one declared in a `project.json` |
| W35 | A screenshot that does not match expectations sends the work back | process | no | UX critic and visual gate feed the loop |
| W36 | Git is read-only for agents | guard | no | Deny every state-changing git command |
| W37 | Commit lines are Conventional Commits, one line, scope is the Nx project | machine | yes | Final verifier runs commitlint on each prepared line |
| W38 | One commit line per affected repository, plus the root pointer bump | process | no | Final verifier reads `git status` in every submodule |
| W39 | The commit type is chosen for its version effect | judgement | no | Reviewer |
| W40 | Agent files are never committed | machine | yes | `.gitignore`, plus a `git ls-files` check |
| W41 | No inline heredocs or one-liners in the terminal | guard | no | Deny pattern |
| W42 | Start from `git diff` and `git status` | process | no | LangGraph supplies the diff with each step |
| W43 | The build passes before work is declared finished | process | no | LangGraph runs the build |
| W44 | Read only the failing window of a log | process | no | LangGraph returns only the failing slice |
| W45 | Zero lint warnings | machine | yes | `tools/ci/lint-budget.mjs` |
| W46 | No credential in the repository | machine | yes | `secretlint` in pre-commit |
| W47 | No high or critical advisory | machine | yes | `tools/ci/audit.mjs` |
| W48 | No credential ever reaches a client bundle | machine | no | Scan `environment.ts`, `public/` and `dist/` for key patterns |
| W49 | Never design a flow that ships a credential to a client | judgement | no | Reviewer; the specialist must stop and ask |
| W50 | Never ask the user to paste a secret | judgement | no | Assistant contract |
| W51 | Workflows pin the Node 24 action versions | machine | no | Workflow scan |
| W52 | Workflows pass `actionlint` | machine | no | LangGraph runs it when `.github/` changes |
| W53 | Workflows never hardcode the list of apps or platforms | judgement | no | Reviewer |
| W54 | `NX_CACHE_DIRECTORY` and `NX_WORKSPACE_DATA_DIRECTORY` are set together | machine | no | Workflow scan |
| W55 | `tsbuildinfo` and `dist/` are never tracked | machine | no | `git ls-files` check |
| W56 | A platform is fully configured or explicitly skipped | machine | yes | `tools/ci/platforms.mjs` |
| W57 | `Automatic versioning` stays on `workflow_run` | machine | no | Workflow scan |
| W58 | `tools/` stays out of the submodules | judgement | no | Reviewer |
| W59 | The relevant skills are read before any code | process | no | LangGraph attaches them to the step |
| W60 | The work state is read first and kept current | process | no | LangGraph's own state replaces `current.md` |
| W61 | Code, documentation and rules are in English | judgement | no | Reviewer |
| W63 | Composition over inheritance, SOLID, DRY | judgement | no | Reviewer |

## oh-save-me

| Id | Rule | Kind | Today | How it is guaranteed |
| --- | --- | --- | --- | --- |
| O01 | The product name comes from the `appName` key, never a literal | machine | no | Literal scan outside translations |
| O02 | `platforms/` is on standby | guard | no | Deny writes unless the story says otherwise |
| O03 | `domain/` is pure TypeScript with no framework | machine | no | ESLint `no-restricted-imports` per layer |
| O04 | RxDB is reached only inside `infrastructure/rxdb/` | machine | no | ESLint `no-restricted-imports` |
| O05 | Line art, minimalism, the main figure is the largest element | judgement | no | UX critic |
| O06 | Every SVG uses `viewBox="0 0 512 512"` | machine | no | SVG scan |
| O07 | Only icons from the collection | judgement | no | Reviewer flags a missing icon |
| O08 | No invented colours or tokens | machine | no | Stylelint strict-value |
| O09 | Tables are a last resort | judgement | no | UX critic |
| O10 | The classifier lives in `domain/` and calls no external API | machine | no | Import restriction on `domain/` |
| O11 | Assistant deck components never appear in the Dashboard | machine | no | Import restriction |
| O12 | Imports are deduplicated by hash | machine | no | A domain spec must exist and pass |
| O13 | Splits sum exactly to the parent amount | machine | no | A domain spec must exist and pass |
| O14 | No financial data leaves the device outside the user's own Drive sync | judgement | no | Reviewer |
| O15 | Frozen identifiers never change | machine | no | Diff scan for the listed identifiers |
| O16 | User-facing strings live in translations | judgement | no | Reviewer |

## papikapi

| Id | Rule | Kind | Today | How it is guaranteed |
| --- | --- | --- | --- | --- |
| P01 | No web-only API is assumed to exist in a WebView | machine | no | Restrict the named globals to their adapter |
| P02 | Device capabilities go through a native bridge with a browser fallback | judgement | no | Reviewer |
| P03 | Every input surface offers dictation with record, stop and accept | judgement | no | UX critic, plus a journey |
| P04 | Translation happens on submit, never while speaking | machine | no | A spec must exist and pass |
| P05 | The user prompt carries only the subject; technical rules stay in the system prompt | machine | yes | `prompt-guard.ts` and its spec |
| P06 | Shelf order never changes | machine | no | A journey must exist and pass |
| P07 | Progress fill is continuous and piece-accurate | machine | no | A spec must exist and pass |
| P08 | Selecting a figure is immediate | machine | no | A journey must exist and pass |

## papikapi-studio

| Id | Rule | Kind | Today | How it is guaranteed |
| --- | --- | --- | --- | --- |
| S01 | Any failing detail on a figure rejects it | process | no | Visual gate verdict is all-or-nothing |
| S02 | No verdict without the rendered image inspected in the same step | process | no | LangGraph requires the image as evidence |
| S03 | The author is never the only judge of its own work | process | no | LangGraph assigns a different agent to judge |

## ibid-ui

| Id | Rule | Kind | Today | How it is guaranteed |
| --- | --- | --- | --- | --- |
| U01 | Components live under `atoms`, `molecules`, `organisms` or `templates` | machine | no | Path check |
| U02 | An atom gains optional inputs without breaking existing callers | machine | no | Existing specs and consuming builds must pass |

## services, utils, testing, boilerplate

| Id | Rule | Kind | Today | How it is guaranteed |
| --- | --- | --- | --- | --- |
| L01 | `services` is headless: no DOM and no templates | machine | no | Import and globals restriction |
| L02 | Every public service method has a spec | judgement | no | Test validator |
| L03 | `utils` holds pure functions with no dependency | machine | partial | `@nx/dependency-checks`, plus W02 |
| L04 | `utils` has full coverage | machine | no | Coverage threshold |
| L05 | `boilerplate` holds no product logic and no single-product dependency | judgement | no | Reviewer |

## From the existing skills

Rules that lived only inside a skill and were in no rule file.

| Id | Rule | Kind | Today | How it is guaranteed |
| --- | --- | --- | --- | --- |
| K01 | Mock data is never inline in a spec; it lives in a `.mock.ts` file with a meaningful name | judgement | no | Test validator and reviewer |
| K02 | A spec imports at most five mock references | machine | no | Import count scan |
| K03 | No inline fallback inside `var()` | machine | no | Stylelint pattern |
| K04 | A component stylesheet holds only its local structure | judgement | no | Reviewer |
| K05 | A measured failure of the visual gate cannot be overruled by looking | process | no | LangGraph takes the measured result |

## Totals

| Kind | Count |
| --- | --- |
| `machine` | 58 |
| `guard` | 5 |
| `process` | 13 |
| `judgement` | 25 |
| All | 101 |

Enforced by something other than memory today: 9, plus 1 partial and 1 unverified.

## Findings

Problems in the current rule files that must be settled before they are rewritten.

| Finding | Detail |
| --- | --- |
| A rule described as enforced is not | `@nx/enforce-module-boundaries` is on, but its only constraint lets every project depend on every other |
| The workspace config breaks two of its own rules | `eslint.config.mjs` carries a comment, written in Portuguese |
| Styles have no checker at all | No Stylelint is installed, so BEM, ITCSS and tokens rely on memory |
| Commit batch size contradicts itself | `oh-save-me` says at most ten files per commit; the workspace says no limit |
| Validation command contradicts itself | Project files tell the agent to run `check:fast`; the workspace forbids it unprompted |
| A product that no longer exists is referenced | `apps/camila` appears in the `oh-save-me`, `boilerplate` and `ibid-ui` rules |
| The comment ban has an undeclared exception | The same file prefers `secretlint-disable` comments for false positives |
| The scratch-folder rule conflicts with a standing instruction | The workspace sends scripts to `tools/scratch/`; the user has said nothing is written in `tools/` |
| The test ban is superseded | Every file ends with "the user runs all tests"; decided otherwise on 2026-11-11 |
| The workspace file is over a hard limit | 31 KB against Antigravity's 24 KB per rule file |
| Project rules are invisible to Antigravity | It loads no rule file from a subfolder |
| The same text is repeated across files | Git, comment and TypeScript rules appear in nine files; the xbar section appears twice |
