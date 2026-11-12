# Boilerplate — Antigravity Workspace Rules

> **Authoritative Rules:** See `.agents/AGENTS.md` in this folder for the complete skeleton rules and workspace standards.
> **Active Status:** See `.agents/current.md` for active milestones and current implementation state.

## 📌 Executive Summary

- **Workspace Scope:** `apps/boilerplate` is the minimal Angular app mould for new products in `ibid-workspace`.
- **Total Workspace Access:** The agent has full access to inspect and modify shared libraries (`../../libs/ibid-ui`, `../../libs/services`, etc.) and tools (`../../tools/`).
- **Core Role:** Inherits build engine from `targetDefaults`, base compiler from `tools/builder/tsconfig.app.base.json`, and UI shell from `libs/ibid-ui`.
- **Prefixes:** `ibid-` for `libs/ibid-ui`, `boilerplate-` for `apps/boilerplate`. The `app-` prefix is strictly banned.
- **Clean Code:** Absolute ban on comments in code and tests. Strict TypeScript.
- **Git:** Agent is read-only. Commits are made by the user in GitHub Desktop.
- **Validation:** `npm run check:fast`, `npm run check:build`, `nx build boilerplate`.

## 🧪 Testing Invariant: The User Runs All Tests

- **The agent is STRICTLY FORBIDDEN from running tests:** Never execute `nx test`, `npm test`, `npm run check:test`, Vitest, or Playwright.
- **Handover Protocol:** The agent outputs the exact CLI command for the user to run in their terminal (e.g. `npx nx test <scope>`).
- The user executes the test command and pastes any failure output for the agent to fix.
