# ibid-workspace — Instructions for Claude Code

Read `.agents/AGENTS.md` first: it holds the workspace rules, shared across tools. This file
only adds what is specific to Claude Code.

## Reading order when starting a task

1. `.agents/current.md` — the state and plan in progress.
2. `.agents/AGENTS.md` — the workspace rules.
3. `apps/<app>/.agents/AGENTS.md` — the rules of the product being touched.
4. The relevant skills in `.agents/skills/`.

## Everyday commands

| For | Command |
| --- | --- |
| Start the app | `npm start` |
| Validate a change | `npx nx affected -t lint test build` |
| Test one project | `npx nx test <project>` |
| E2E journeys | `npm run e2e` |
| Accessibility | `npm run test:a11y` |
| See the graph | `npx nx graph` |

## Limits

- Git is read-only. Committing belongs to the user, through GitHub Desktop.
- Hand work over in a single batch with no file limit, each affected repository with its commit
  message line and nothing else: no description, no body, no git commands.
- Never commit agent files.
- Never write comments in code.
- Never touch the `SavvyJar` repository — it is a read-only source, nothing more.
- Write all documentation in English.
