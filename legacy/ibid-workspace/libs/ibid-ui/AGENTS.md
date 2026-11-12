# ibid-ui — Antigravity Workspace Rules

> **Authoritative Rules:** See `.agents/AGENTS.md` in this folder for the complete design system rules, component lifecycle, and workspace standards.
> **Active Status:** See `.agents/current.md` for active milestones and current implementation state.

## 📌 Executive Summary

- **Workspace Scope:** `libs/ibid-ui` is the shared Design System and UI component library across all products in `ibid-workspace`.
- **Selector Prefix:** `ibid-` is mandatory for every component, directive, and pipe (e.g. `<ibid-button>`, `<ibid-header>`, `[ibidHandDrawn]`). The `app-` prefix is strictly banned.
- **Encapsulation Invariant:** Native HTML elements (`<button>`, `<input>`, `<select>`, `<dialog>`) are allowed **only inside the atom that encapsulates them**.
- **Component Lifecycle:** Every component must have a Storybook story (`*.stories.ts`) and unit test (`*.spec.ts`) before being consumed in any app.
- **Styles:** ITCSS layers in `src/styles/` and strict BEM naming (`.block__element--modifier`).
- **Clean Code:** Absolute ban on comments in code and tests. Strict TypeScript.
- **Git:** Agent is read-only. Commits are made by the user in GitHub Desktop.
- **Validation:** `npm run check:fast`, `npm run check:ibid-ui`, `nx build ibid-ui`, `nx test ibid-ui`.

## 🧪 Testing Invariant: The User Runs All Tests

- **The agent is STRICTLY FORBIDDEN from running tests:** Never execute `nx test`, `npm test`, `npm run check:test`, Vitest, or Playwright.
- **Handover Protocol:** The agent outputs the exact CLI command for the user to run in their terminal (e.g. `npx nx test <scope>`).
- The user executes the test command and pastes any failure output for the agent to fix.
