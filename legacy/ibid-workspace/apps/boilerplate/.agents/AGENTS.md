# boilerplate — Skeleton Rules & Workspace Standards

This app is not a product: it is the mould new products start from within the **ibid-workspace** monorepo. It is automatically discovered and loaded into the agent's system prompt on every conversation turn.

---

## 🏛️ Monorepo Structure & Total Workspace Access

`apps/boilerplate` is a git submodule within the `ibid-workspace` monorepo:
```
apps/
  boilerplate/         design system showcase & shared host (submodule)
  oh-save-me/          financial tracking product
  camila/              parenting kirigami product
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
  - `libs/ibid-ui`: `ibid-` (e.g. `<ibid-header>`, `<ibid-header-nav>`).
  - `apps/boilerplate`: `boilerplate-` (e.g. `<boilerplate-root>`).
  - **The `app-` prefix is strictly banned** across the entire workspace.
- **Reuse first, create second:**
  - Before writing any UI element, check `libs/ibid-ui` for what already exists.
  - Native HTML elements (`<button>`, `<input>`, `<select>`, `<dialog>`) are allowed **only inside the atom that encapsulates them** in `ibid-ui` — never in molecules, organisms, templates, or pages.

---

## 📋 Active Work Plan: `.agents/current.md`

- `.agents/current.md` is the **single source of truth** for current progress, completed milestones, and immediate next steps.
- **Mandatory read:** Before proposing changes or running code, inspect `.agents/current.md` to understand context and status.
- **Keep it current:** Update `.agents/current.md` as each task is completed and verified.

---

## 🏗️ What the Boilerplate Is

A minimal Angular app that already demonstrates the three things it inherits:

| Inherited | Where you see it |
| --- | --- |
| Build engine | `project.json` declares only styles and budgets; everything else comes from `targetDefaults` |
| Compiler base | `tsconfig.json` extends `tools/builder/tsconfig.app.base.json` and declares only its own `paths` |
| Design system | `styles.scss` is minimal, and `app.html` assembles the shell with `ibid-header` and `ibid-header-nav` |

The navigation shell is wired on purpose: it is the first thing any product needs, and it stops each one reinventing it.

---

## 🙅 What Never Belongs Here

- Business logic from any product.
- Configuration that already comes from `targetDefaults` in `nx.json`.
- Dependencies only one product uses.

---

## 🚀 Starting a New Product

1. Copy `apps/boilerplate` to `apps/<new-product>`.
2. In `project.json`: change `name`, `prefix`, and the `styles` list.
3. In `tsconfig.json`: adjust the `paths` block to the new product's layers.
4. In `eslint.config.mjs`: set the selector prefix to the new product's name.
5. Create `apps/<new-product>/.agents/AGENTS.md` with that product's domain rules.
6. Confirm with `npx nx build <new-product>` before writing the first feature.

---

## 💎 Clean Code & TypeScript Standards

- **Absolute ban on comments:** Writing code comments in source or test files is forbidden. Code must be completely self-explanatory through naming and structure.
- **Strict TypeScript:** Never use `any` (use `unknown` or generics). Prefer `readonly`. Use `as const` or union types instead of numeric enums.
- **File size:** Max 200–300 lines per file. Small functions with a single responsibility.
- **Styles:** SCSS following ITCSS layers (`libs/ibid-ui/src/styles/`) and BEM naming (`.block__element--modifier`).

---

## 🌿 Git & Versioning Conventions

- **Committing belongs to the user** through GitHub Desktop.
- **Agent is strictly read-only on git:** Permitted: `git status`, `git diff`, `git log`. Forbidden: `git add`, `git commit`, `git push`, `git checkout`, `git stash`, etc.
- **Handover protocol:** The agent provides a single-line Conventional Commit **ONLY when explicitly requested by the user**.
  - Format: `type(scope): description` (e.g. `fix(boilerplate): wire nav shell resize observer`).
  - Scope is `boilerplate`.

---

## ✅ Nx Validation & Execution Loop

- Run validation commands through Nx:
  - `npm run check:fast` — Lints, tests, and builds affected projects.
  - `npm run check:build` — Verifies compilation of all projects.
  - `nx build boilerplate` — Verifies compilation of Boilerplate.
  - `nx test boilerplate` — Runs Boilerplate unit tests.
- **Mandatory verification:** Never declare a task complete without running compilation verification (`npm run check:fast` or `nx build boilerplate`).

## 🧪 Testing Invariant: The User Runs All Tests

- **The agent is STRICTLY FORBIDDEN from running tests:** Never execute `nx test`, `npm test`, `npm run check:test`, Vitest, or Playwright.
- **Handover Protocol:** The agent outputs the exact CLI command for the user to run in their terminal (e.g. `npx nx test <scope>`).
- The user executes the test command and pastes any failure output for the agent to fix.
