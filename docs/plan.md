# Plan

Agreed with the user on 2026-11-11.

## Why

- Claude and Antigravity often skip explicit project rules, and the user has to repeat them.
- The workspace rule file is 31 KB. Antigravity reads at most 24 KB per rule file.
- Antigravity does not load rule files from subfolders, which is where every project's rules are.
- There are three copies of the rules, one per tool, and the tools do not behave alike.
- Almost every rule depends on the model remembering it.

## What

1. Move the whole agent system out of `ibid-workspace` into this repository.
2. Keep one set of rules for every tool.
3. Give the user one assistant, invoked as `/assistant` inside Claude Desktop or Antigravity. It
   speaks plain language and prepares the user story and its acceptance criteria.
4. Give each project a specialist that plans the work and calls the agents it needs.
5. Put a the flow engine program underneath, reached over MCP. It hands out one step at
   a time, runs the checks itself, and only advances when they pass.
6. Leave the user with code review and the commit, with the commit line already prepared.

## How a request flows

1. The user types `/assistant` and what they want, with images and files if useful.
2. The assistant asks questions until the user story is right.
3. The user says to go ahead. The assistant names the project and hands the story over.
4. The specialist submits a plan. The flow engine rejects it if a mandatory step of that project's
   sheet is missing.
5. One agent works on each step. The flow engine verifies it and returns the exact error on failure.
6. At the end the flow engine runs the same gates as Husky and matches every acceptance criterion to
   a test that proves it.
7. The assistant reports back in plain language with one commit line per repository.
8. The user reviews the code and commits.

## Agents

| Agent | Job | Starting point |
| --- | --- | --- |
| Assistant | User stories and acceptance criteria | `product-owner-assistant` |
| Specialist | Plan and orchestration, one per app and library | `solution-architect`, project rules |
| Developer | Writes the code | Official Angular skill, Nx skills |
| UI | HTML, CSS and animation | `web-design`, Modern Web Guidance |
| UX critic | Uses the screen and reports problems. Writes no code | New |
| Test author | Writes tests from the story, without seeing the code | `qa-tester` |
| Test validator | Confirms the tests prove the criteria | `qa-tester` |
| Journeys | Full user journeys on the mobile viewport | `playwright`, Playwright test agents |
| Browser QA | Exercises the running app | Playwright MCP, Chrome DevTools MCP |
| Accessibility and performance | Measures and reports | Chrome DevTools MCP, `test-a11y` |
| Visual gate | Compares figures and models with the reference art | `visual-qa` |
| Reviewer | Checks the judgement rules against the diff | `code-auditor` |
| Final verifier | Husky gates and the commit line | New |

## How rules are guaranteed

| Kind | Guarantee | Mechanism |
| --- | --- | --- |
| Machine-checkable | Full | The flow engine runs the check on every step |
| Forbidden action | Full | A guard denies it when attempted |
| Step order | Full | The flow engine owns the order and the evidence required |
| Judgement | Partial | Reviewer and UX critic, then the user's code review |

## Build order

1. The repository exists. Done.
2. Rule table: every rule, its kind, and how it is guaranteed.
3. Rules reorganised: a small always-on core under both tools' limits, and one sheet per project.
4. The flow engine, with the flow and the checks.
5. The assistant and the `papikapi` specialist.
6. Guards in both tools, tested in both.
7. The remaining agents, one at a time, each with its own trials.
8. Pilot with one real user story in `papikapi`.
9. The other projects, then the workspace clean-up. Nothing is deleted before the user confirms
   the new system works.

## What keeps it standing

- Trials per agent: example tasks with a known right answer, re-run whenever instructions change.
- Every rule the user finds broken in code review becomes a check or a reviewer rule.
- Measurement: violations reaching code review, before and after.

## Decisions

- The flow engine is a requirement.
- The user works inside Claude Desktop and Antigravity. No command line and no new chat app.
- In this system unit and browser tests run without the user launching them.
- The commit is always the user's.
- Each tool uses its own subscription directly. Antigravity is never wrapped by another
  application, which its terms do not support on consumer plans.

## Limits

- Judgement rules are never fully guaranteed.
- Voice input is whatever each tool offers.
- Each tool uses its own model. One model does not judge another within a task.
- The flow engine is the user's own code and needs maintenance.

## To confirm while building

- Antigravity hooks, known only from documentation so far.
- The Storybook MCP server with Angular.
- The pass threshold of the visual gate, to be tuned on the user's own examples.
