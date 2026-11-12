# utils — Pure Utility Functions Rules

This document is the single, authoritative source of truth for **libs/utils** within the **ibid-workspace** monorepo. It is automatically discovered and loaded into the agent's system prompt on every conversation turn.

---

## 🏛️ Monorepo Role & Scope

`libs/utils` is the only shared library that other libraries may import:
- Pure functions only: mathematical formulas, formatting, currency arithmetic, date parsing.
- **Zero dependencies** on any other library or framework module.
- Fully tree-shakeable.

---

## 💎 Clean Code & TypeScript Standards

- **Absolute ban on comments.**
- **Strict TypeScript:** Pure input/output functions, immutable parameters, no side effects.
- 100% unit test coverage mandatory.

---

## 🌿 Git & Versioning Conventions

- **Committing belongs to the user** through GitHub Desktop.
- **Agent is strictly read-only on git.** Scope: `utils`.

## 🧪 Testing Invariant: The User Runs All Tests

- **The agent is STRICTLY FORBIDDEN from running tests:** Never execute `nx test`, `npm test`, `npm run check:test`, Vitest, or Playwright.
- **Handover Protocol:** The agent outputs the exact CLI command for the user to run in their terminal (e.g. `npx nx test <scope>`).
- The user executes the test command and pastes any failure output for the agent to fix.
