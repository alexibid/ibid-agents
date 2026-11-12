# testing — Antigravity Workspace Rules

> **Authoritative Rules:** See `.agents/AGENTS.md` in this folder for test helper standards.
> **Active Status:** See `.agents/current.md` for active milestones.

## 📌 Executive Summary

- **Workspace Scope:** `libs/testing` provides test fixtures, in-memory repository fakes, and Playwright Deterministic Stateful Journey (DSJ) helpers.
- **Clean Code:** Absolute ban on comments in code and tests.
- **Git:** Agent is read-only. Commits are made by the user in GitHub Desktop.
- **Validation:** `nx build testing`, `nx test testing`.

## 🧪 Testing Invariant: The User Runs All Tests

- **The agent is STRICTLY FORBIDDEN from running tests:** Never execute `nx test`, `npm test`, `npm run check:test`, Vitest, or Playwright.
- **Handover Protocol:** The agent outputs the exact CLI command for the user to run in their terminal (e.g. `npx nx test <scope>`).
- The user executes the test command and pastes any failure output for the agent to fix.
