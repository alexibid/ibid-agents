# utils — Antigravity Workspace Rules

> **Authoritative Rules:** See `.agents/AGENTS.md` in this folder for utility library standards.
> **Active Status:** See `.agents/current.md` for active milestones.

## 📌 Executive Summary

- **Workspace Scope:** `libs/utils` contains pure, zero-dependency utility functions (math, formatting, currency, dates).
- **Dependency Rule:** Pure library. Zero dependencies on other libs or apps.
- **Clean Code:** Absolute ban on comments. Pure functions, 100% test coverage.
- **Git:** Agent is read-only. Commits are made by the user in GitHub Desktop.
- **Validation:** `nx build utils`, `nx test utils`.

## 🧪 Testing Invariant: The User Runs All Tests

- **The agent is STRICTLY FORBIDDEN from running tests:** Never execute `nx test`, `npm test`, `npm run check:test`, Vitest, or Playwright.
- **Handover Protocol:** The agent outputs the exact CLI command for the user to run in their terminal (e.g. `npx nx test <scope>`).
- The user executes the test command and pastes any failure output for the agent to fix.
