# Oh Save Me! — System Architecture, Product & Workspace Rules

This document is the single, authoritative source of truth for the **Oh Save Me!** application within the **ibid-workspace** monorepo. It is automatically discovered and loaded into the agent's system prompt on every conversation turn.

---

## 🏛️ Monorepo Structure & Total Workspace Access

`apps/oh-save-me` is a git submodule within the `ibid-workspace` monorepo:
```
apps/
  oh-save-me/          financial tracking product (submodule)
  camila/              kirigami parenting product
  boilerplate/         design system showcase & shared host
libs/
  ibid-ui/             shared design system & UI components
  services/            shared services (i18n, storage, auth)
  testing/             shared test helpers
  utils/               pure utility functions
tools/                 workspace configuration, CI, and QA runner
```

### Total Workspace Access Protocol
- **Cross-library responsibility:** The agent has full access to inspect and modify shared libraries (`../../libs/ibid-ui`, `../../libs/services`, `../../libs/utils`) and workspace configurations when required by the task.
- **Dependency rule:** Apps may import from any lib (`libs/*`). Libs never import from apps.
- **Selector prefixes:**
  - `libs/ibid-ui`: `ibid-` (e.g. `<ibid-button>`, `<ibid-card>`).
  - `apps/oh-save-me`: `ohsaveme-` (e.g. `<ohsaveme-transactions-table>`, `[ohsavemeDetectSticky]`).
  - **The `app-` prefix is strictly banned** across the entire workspace.
- **Reuse first, create second:**
  - Before writing any UI element, check `libs/ibid-ui` for what already exists.
  - Native HTML elements (`<button>`, `<input>`, `<select>`, `<dialog>`) are allowed **only inside the atom that encapsulates them** in `ibid-ui` — never in molecules, organisms, templates, or pages.
  - If a component or atom is missing or needs a new capability, create or extend it in `libs/ibid-ui` with story and spec before consuming it in `oh-save-me`.

---

## 📋 Active Work Plan: `.agents/current.md`

- `.agents/current.md` is the **single source of truth** for current progress, completed milestones, and immediate next steps.
- **Mandatory read:** Before proposing changes or running code, inspect `.agents/current.md` to understand context and status.
- **Keep it current:** Update `.agents/current.md` as each task is completed and verified.

---

## 🚀 Oh Save Me! System Architecture & Domain Rules

**Product Name:** **Oh Save Me!** in English, **Oh poupa-me!** in Portuguese. The name varies by locale through the `appName` translation key — never write the literal name in code or templates.

Full product context: `PRD.md` and `MVP.md` in this folder.

### 🌐 Scope
Strictly focused on the **Web (Angular SPA)**. The Tauri (desktop) and Capacitor (mobile) integrations under `platforms/` are on standby: resume them only when explicitly asked.

### 🏛️ DDD Layers (under `src/app/`)
| Layer | Contents |
| --- | --- |
| `domain/` | Entities, value objects, rules, and repository interfaces. Pure TypeScript, no framework |
| `infrastructure/` | RxDB persistence adapters, external APIs, Google Drive synchronisation |
| `application/` | Use cases, reactive state with signals, i18n and translations |
| `ui/` | Presentation: `atoms/` → `molecules/` → `organisms/`, plus `templates/` and `pages/` |

Persistence is **RxDB**. Never reach SQLite or IndexedDB outside `src/app/infrastructure/rxdb/`.

---

## 🎨 Design System: Line Art & Minimalism

- The baseline is native Angular Material, with no theme overrides and no third-party kits.
- **Mandatory style:** Line art / hand-drawn. The main background is present on every page.
- **Minimalism:** Use as much of the visible area as possible for data. Tables and charts do not carry hand-drawn borders that waste space.
- **Cards:** The main figure is always the largest element. With a lot of data, split into child cards. Hand-drawn outline via `clip-path`.
- **Icons:** Using icons outside the collection is forbidden. If one is missing, flag it. Every SVG uses `viewBox="0 0 512 512"` without distortion, and fits its parent with `width: 100%; height: 100%`.
- **Never invent colours or tokens.** If the design tool is unreachable, ask the user rather than assuming.
- **Never fake HTML** to mirror components: extract the real structure and styles from the Angular source, preserving BEM and ITCSS.

---

## 🙅 The Anti-Table Principle

The audience wants direct answers ("can I afford a holiday?"), not a BI tool. Before designing a dense grid as the primary interface, prefer cards carrying the answer already computed, inline confirmation, or batch review screens. Tables are a last resort.

---

## 🧠 On-Device ML Engine

A lightweight Naïve Bayes classifier in pure TypeScript inside `domain/`. No external APIs.
- Layer 1: A built-in dictionary of known Portuguese merchants.
- Layer 2: Private rules learned and persisted in RxDB whenever the user confirms or corrects a category. These always override the global ones.
- Changing a category triggers the batch re-categorisation flow before applying en masse.

---

## 📥 Import Assistant

The same dual-layer pattern, applied to CSV structure instead of transaction description:
- Layer 1: Header signatures per bank. Layer 2: Content heuristics. Layer 3: User corrections become a private template.
- After importing, transactions go through batch triage with a pre-filled category. Anything skipped stays pending with a persistent, non-blocking notification.

---

## 🤖 Operational Assistant versus Smart Insights

- **Assistant (floating FAB):** Data hygiene and pending operational tasks. Deck/stack visual language.
- **Smart Insights (Dashboard):** Deterministic financial intelligence, patterns, and anticipated questions.
- **Never mix them:** The assistant's deck components never appear in the Dashboard. Insights have their own organism, integrated into the grid.

---

## ✅ Domain Correctness & Zero Knowledge

- Imported transactions are deduplicated by hash (date + description + amount). Never import the same statement line twice across overlapping uploads.
- A transaction's splits always sum exactly to the parent amount. Any discrepancy is a bug, not a rounding artefact.
- Nothing weakens the local-first, zero-knowledge guarantee: no financial data leaves the device except through the user's own explicit, encrypted Google Drive sync.

---

## ⚠️ Frozen Technical Identity

These values identify the app to external systems and to existing installations. Do not change them without an explicit decision from the user:
- `com.savvyjar.app` — Android, iOS, and the OAuth redirect scheme registered with Google.
- `savvy_google_*` and `savvy_shared_recipients` — localStorage keys belonging to current users.
- The Firebase project and the production domain.

---

## 💎 Clean Code & TypeScript Standards

- **Absolute ban on comments:** Writing code comments in source or test files is forbidden. Code must be completely self-explanatory through naming and structure.
- **Strict TypeScript:** Never use `any` (use `unknown` or generics). Prefer `readonly`. Use `as const` or union types instead of numeric enums.
- **File size:** Max 200–300 lines per file. Small functions with a single responsibility.
- **Design tool neutrality:** Never name tools (Figma, Paper) in source code; use "Design System" or "Tokens".
- **Styles:** SCSS following ITCSS layers (`libs/ibid-ui/src/styles/`) and BEM naming (`.block__element--modifier`).

---

## 🌿 Git & Versioning Conventions

- **Committing belongs to the user** through GitHub Desktop.
- **Agent is strictly read-only on git:** Permitted: `git status`, `git diff`, `git log`. Forbidden: `git add`, `git commit`, `git push`, `git checkout`, `git stash`, etc.
- **Handover protocol:** The agent provides a single-line Conventional Commit **ONLY when explicitly requested by the user**.
  - Format: `type(scope): description` (e.g. `fix(oh-save-me): resolve circular import in recategorize dialog`).
  - Default type is `fix` unless substantial new functionality warrants `feat`.
  - Batch size: at most 10 files per commit.
  - No commands, no body, no footer. Single line only.

---

## ✅ Nx Validation & Execution Loop

- Run validation commands through Nx:
  - `npm run check:fast` — Lints, tests, and builds affected projects.
  - `npm run check:build` — Verifies compilation of all projects.
  - `nx build oh-save-me` — Verifies compilation of Oh Save Me!
  - `nx test oh-save-me` — Runs Oh Save Me! unit tests.
- **Mandatory verification:** Never declare a task complete without running compilation verification (`npm run check:fast` or `nx build oh-save-me`).
- E2E browser tiers (`t3`) belong to the user; the agent does not run browser suites autonomously.

---

## 🌍 Language & Terminology

- All code, documentation, rules, and agent instructions must be in **English**.
- User-facing strings live in translation files (`i18n.config.ts`), never hardcoded in templates.

## 🧪 Testing Invariant: The User Runs All Tests

- **The agent is STRICTLY FORBIDDEN from running tests:** Never execute `nx test`, `npm test`, `npm run check:test`, Vitest, or Playwright.
- **Handover Protocol:** The agent outputs the exact CLI command for the user to run in their terminal (e.g. `npx nx test <scope>`).
- The user executes the test command and pastes any failure output for the agent to fix.
