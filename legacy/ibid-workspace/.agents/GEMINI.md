# Antigravity Workspace Engine — ibid-workspace

Read `GEMINI.md` at root and `.agents/current.md` first: they hold the primary directives and the active
memory/state of work in progress for this workspace.

## Reading order when starting a task

1. `.agents/current.md` — the state and plan in progress.
2. `.agents/AGENTS.md` — the workspace rules.
3. `apps/<app>/.agents/AGENTS.md` — the rules of the product being touched.
4. The relevant skills in `.agents/skills/`.

## Everyday commands

| For | Command |
| --- | --- |
| Start the app | `npm start` |
| Validate everything | `npm run check` (or `npm run check:all`) |
| Fast affected check | `npm run check:fast` |
| Build all projects | `npm run build` |
| Test all projects | `npm run test` |
| Lint all projects | `npm run lint` |
| E2E journeys | `npm run e2e` (or `npm run check:e2e`) |
| Accessibility | `npm run test:a11y` (or `npm run check:a11y`) |
| Worktree Oh Save Me | `npm run worktree:oh-save-me` |
| Worktree Camila | `npm run worktree:camila` |
| Sync Standalone Repos | `npm run split` |
| macOS Menu Bar (xbar) | `tools/xbar/ibid-runner.10s.sh` |

## Limits & Handover Protocol

- Git is read-only. Committing belongs to the user, through GitHub Desktop.
- **Mandatory build on finish:** Always run `npm run build` (or `npm run check:build`) before declaring a task finished.
- **Do not run `check:fast` unless told to:** The agent is strictly forbidden from running `npm run check:fast` unprompted.
- **Commit text on request only:** Do not display commit messages proactively. Provide a single-line
  Conventional Commit message only when explicitly requested by the user, reading `git status` and
  defaulting to `fix(...)` unless it is a genuine new feature (`feat(...)`).
- Hand work over in a single batch with no file limit.
- Never commit agent files.
- Never write comments in code.
- Never touch the `SavvyJar` repository — it is a read-only source, nothing more.
- Write all documentation in English.
