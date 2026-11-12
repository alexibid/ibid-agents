# testing — Shared Test Helpers & Harness Rules

This document is the single, authoritative source of truth for **libs/testing** within the **ibid-workspace** monorepo. It is automatically discovered and loaded into the agent's system prompt on every conversation turn.

---

## 🏛️ Monorepo Role & Scope

`libs/testing` holds reusable test infrastructure:
- **In-memory repositories and mocks:** Pure test fakes for domain interfaces.
- **DSJ Helpers:** Deterministic Stateful Journey steps and screenshot collectors for Playwright.
- **Clock and seed fixtures:** Deterministic date freezing and seeded datasets.

---

## 💎 Clean Code & Standards

- **Absolute ban on comments:** Code and tests explain themselves through naming.
- **Strict TypeScript:** No `any`. Strongly typed assertions and fixtures.

---

## 🌿 Git & Versioning Conventions

- **Committing belongs to the user** through GitHub Desktop.
- **Agent is strictly read-only on git.** Scope: `testing`.

## 🧪 Testing Invariant: The User Runs All Tests

- **The agent is STRICTLY FORBIDDEN from running tests:** Never execute `nx test`, `npm test`, `npm run check:test`, Vitest, or Playwright.
- **Handover Protocol:** The agent outputs the exact CLI command for the user to run in their terminal (e.g. `npx nx test <scope>`).
- The user executes the test command and pastes any failure output for the agent to fix.
