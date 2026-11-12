# services — Antigravity Workspace Rules

> **Authoritative Rules:** See `.agents/AGENTS.md` in this folder for the complete shared services standards.
> **Active Status:** See `.agents/current.md` for active milestones.

## 📌 Executive Summary

- **Workspace Scope:** `libs/services` provides shared core application services (I18n, Google Drive sync, local storage, auth).
- **Dependency Rule:** `libs/services` may import only from `libs/utils`. Never import from apps or UI libraries.
- **Clean Code:** Absolute ban on comments in code and tests. Strict TypeScript.
- **Git:** Agent is read-only. Commits are made by the user in GitHub Desktop.
- **Validation:** `npm run check:fast`, `nx build services`, `nx test services`.

## 🧪 Testing Invariant: The User Runs All Tests

- **The agent is STRICTLY FORBIDDEN from running tests:** Never execute `nx test`, `npm test`, `npm run check:test`, Vitest, or Playwright.
- **Handover Protocol:** The agent outputs the exact CLI command for the user to run in their terminal (e.g. `npx nx test <scope>`).
- The user executes the test command and pastes any failure output for the agent to fix.
