# ibid-workspace — Monorepo Architecture & Rules

> **Authoritative Rules:** See `.agents/AGENTS.md` for the complete workspace rules, architecture, and standards.
> **Active Status:** See `.agents/current.md` for active workspace milestones and changelog.

## 📌 Executive Summary

- **Workspace Scope:** Total read and write access across all products (`apps/*`), shared libraries (`libs/*`), and workspace tools (`tools/*`).
- **Dependency Rule:** Apps may import from any lib (`libs/*`). Libs never import from apps. Between libs, only `utils` is allowed.
- **Prefixes:**
  - `libs/ibid-ui`: `ibid-` (e.g. `<ibid-button>`, `<ibid-card>`).
  - `apps/oh-save-me`: `ohsaveme-`
  - `apps/camila`: `camila-`
  - `apps/boilerplate`: `boilerplate-`
  - **The `app-` prefix is strictly banned** across the entire workspace.
- **Reuse First, Create Second:** Always check `libs/ibid-ui` before writing interface elements. Native HTML primitives (`<button>`, `<input>`) belong only inside their dedicated encapsulating atom.
- **Clean Code & Strict TypeScript:** Absolute ban on comments in code and tests. Strict TypeScript (no `any`, max 200-300 lines per file). ITCSS & BEM.
- **Git:** Agent is read-only. Commits are made by the user in GitHub Desktop. When requested, always provide the related Conventional Commit messages for all affected submodules and the workspace root.
- **Validation:** `npm run check:fast`, `npm run check:build`, `npm run check:all`.

## 🧪 Testing Invariant: The User Runs All Tests

- **The agent is STRICTLY FORBIDDEN from running tests:** Never execute `nx test`, `npm test`, `npm run check:test`, Vitest, or Playwright.
- **Handover Protocol:** The agent outputs the exact CLI command for the user to run in their terminal (e.g. `npx nx test <scope>`).
- The user executes the test command and pastes any failure output for the agent to fix.
