# ibid-ui — Shared Design System & Component Library Rules

This document is the single, authoritative source of truth for **libs/ibid-ui** within the **ibid-workspace** monorepo. It is automatically discovered and loaded into the agent's system prompt on every conversation turn.

---

## 🏛️ Monorepo Role & Scope

`libs/ibid-ui` is the foundational UI library consumed by all applications (`apps/oh-save-me`, `apps/camila`, `apps/boilerplate`).

### Dependency Rules
- **Libs never import from apps.** `libs/ibid-ui` imports only from `libs/utils` (or pure external angular packages).
- **Reusable first:** Any UI primitive or pattern shared across or needed by an app belongs here, not inside the app.
- **Selector Prefix:** **`ibid-`** is mandatory across the entire library:
  - Components: `<ibid-button>`, `<ibid-card>`, `<ibid-chip>`, `<ibid-textarea>`.
  - Directives: `[ibidHandDrawn]`, `[ibidDetectSticky]`.
  - Pipes: `ibidCurrency`, etc.
  - **The `app-` prefix is strictly banned.**

---

## 🧱 Atomic Design Structure

Organised under `src/lib/`:
```
atoms/         lowest-level encapsulations (button, input, icon, chip, scrim, textarea)
molecules/     simple compositions of atoms (field-group, search-bar, stat-badge)
organisms/     complex multi-component widgets (header, header-nav, navigation-drawer)
templates/     layout frames and structural shells
styles/        global ITCSS layers and token definitions
```

### The Atom Encapsulation Invariant
Writing raw HTML primitives (`<button>`, `<input>`, `<select>`, `<dialog>`) outside their encapsulating atom is strictly forbidden. If an organism or app needs a button, it consumes `<ibid-button>`. If an existing atom needs a new property, extend the atom with optional inputs without breaking existing callers.

---

## 🎨 Styles: ITCSS & BEM

Global SCSS under `src/styles/` follows ITCSS by increasing specificity:
1. `settings/`: Tokens, variables, design palettes.
2. `tools/`: Mixins and functions (never emit CSS directly).
3. `generic/`: Box-sizing, reset.
4. `elements/`: Unclassed HTML elements.
5. `objects/`: Class-based page layout grids.
6. `components/`: Specific visual component styles.
7. `trumps/`: High-specificity helpers and overrides.

**BEM Naming:** Strict BEM for all classes: `.block`, `.block__element`, `.block--modifier`.

---

## 📸 Component Lifecycle: Story & Spec Mandatory

When creating or modifying any UI element:
1. **Storybook story (`*.stories.ts`):** Must be placed in the same directory as the component. Minimal boilerplate using Compodoc for autodocs.
2. **Unit test (`*.spec.ts`):** Spec-driven TDD asserting behavioral boundaries.
3. **No comments:** Tests document themselves through `it('should...')`. Code explains itself through naming.

---

## 💎 Clean Code & TypeScript Standards

- **Absolute ban on comments:** Writing code comments in source or test files is forbidden.
- **Strict TypeScript:** Never `any`, prefer `readonly`, use `as const` or union types instead of numeric enums.
- **File size:** Max 200–300 lines per file. Small functions with single responsibilities.

---

## 🌿 Git & Versioning Conventions

- **Committing belongs to the user** through GitHub Desktop.
- **Agent is strictly read-only on git.**
- **Handover protocol:** Single-line Conventional Commit ONLY when explicitly requested by user. Format: `type(ibid-ui): description`. Default type is `fix`.

---

## ✅ Nx Validation & Execution Loop

- `npm run check:fast` — Lints, tests, and builds affected projects.
- `npm run check:ibid-ui` — Targeted check for `ibid-ui`.
- `nx build ibid-ui` — Compiles the library.
- `nx test ibid-ui` — Runs library unit tests.
- `npm run storybook:start` — Starts the boilerplate Storybook host on port 6006.

## 🧪 Testing Invariant: The User Runs All Tests

- **The agent is STRICTLY FORBIDDEN from running tests:** Never execute `nx test`, `npm test`, `npm run check:test`, Vitest, or Playwright.
- **Handover Protocol:** The agent outputs the exact CLI command for the user to run in their terminal (e.g. `npx nx test <scope>`).
- The user executes the test command and pastes any failure output for the agent to fix.
