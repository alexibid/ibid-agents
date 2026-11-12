# services — Shared Core Services Rules

This document is the single, authoritative source of truth for **libs/services** within the **ibid-workspace** monorepo. It is automatically discovered and loaded into the agent's system prompt on every conversation turn.

---

## 🏛️ Monorepo Role & Scope

`libs/services` provides headless, cross-cutting business and platform services across products:
- **I18nService:** Translation dictionary management and language switching (`pt` / `en`).
- **Google Drive Sync:** OAuth lifecycle and encrypted JSON document sync to Google Drive.
- **Storage Services:** Partitioned client storage and secure state bridges.

### Dependency Invariants
- Can import from: `libs/utils`.
- **Never imports from apps or UI libraries.**
- Pure headless TypeScript: no DOM, no HTML templates.

---

## 💎 Clean Code & TypeScript Standards

- **Absolute ban on comments:** Writing code comments in source or test files is forbidden.
- **Strict TypeScript:** Zero `any`, prefer `readonly`, typed Error throws instead of error codes.
- **Unit test coverage:** Every public service method must have comprehensive `*.spec.ts` coverage.

---

## 🌿 Git & Versioning Conventions

- **Committing belongs to the user** through GitHub Desktop.
- **Agent is strictly read-only on git.**
- **Handover protocol:** Single-line Conventional Commit ONLY when explicitly requested by user. Format: `type(services): description`.

---

## ✅ Nx Validation Loop

- `npm run check:fast` — Lints, tests, and builds affected projects.
- `nx build services` — Compiles the library.
- `nx test services` — Runs unit tests.

## 🧪 Testing Invariant: The User Runs All Tests

- **The agent is STRICTLY FORBIDDEN from running tests:** Never execute `nx test`, `npm test`, `npm run check:test`, Vitest, or Playwright.
- **Handover Protocol:** The agent outputs the exact CLI command for the user to run in their terminal (e.g. `npx nx test <scope>`).
- The user executes the test command and pastes any failure output for the agent to fix.
