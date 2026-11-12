# Oh Save Me! — Antigravity Workspace Rules

> **Authoritative Rules:** See `.agents/AGENTS.md` in this folder for the complete product rules, system architecture, and workspace standards.
> **Active Status:** See `.agents/current.md` for active milestones and current implementation state.

## 📌 Executive Summary

- **Workspace Scope:** `apps/oh-save-me` is an Angular SPA within the `ibid-workspace` monorepo.
- **Total Workspace Access:** The agent has full access to inspect and modify shared libraries (`../../libs/ibid-ui`, `../../libs/services`, etc.) and tools (`../../tools/`).
- **Core Product Loop:** Transaction import/entry → on-device Naïve Bayes classifier → batch triage → card-based insights (anti-table principle) → encrypted Google Drive sync.
- **Architecture:** DDD layers (`domain/`, `infrastructure/rxdb/`, `application/`, `ui/`). Local RxDB persistence.
- **Prefixes:** `ibid-` for `libs/ibid-ui`, `ohsaveme-` for `apps/oh-save-me`. The `app-` prefix is strictly banned.
- **Clean Code:** Absolute ban on comments in code and tests. Strict TypeScript.
- **Git:** Agent is read-only. Commits are made by the user in GitHub Desktop.
- **Validation:** `npm run check:fast`, `npm run check:build`, `nx build oh-save-me`.

## 🧪 Testing Invariant: The User Runs All Tests

- **The agent is STRICTLY FORBIDDEN from running tests:** Never execute `nx test`, `npm test`, `npm run check:test`, Vitest, or Playwright.
- **Handover Protocol:** The agent outputs the exact CLI command for the user to run in their terminal (e.g. `npx nx test <scope>`).
- The user executes the test command and pastes any failure output for the agent to fix.
