# Poupado — Instructions for Claude Code

> **Vision & rationale live in `PRD.md`; current scope lives in `MVP.md`** (both at the repo root). **Monetization/business strategy lives in `.agents/BUSINESS.md`** — kept separate so this file and the PRD stay product/engineering-only. Read them before making product decisions — this file covers engineering conventions, not *why* a feature exists or *how far* it should go.

Poupado is a multi-platform (Web/macOS/Windows/iOS/Android) personal finance app built on three pillars: **Extreme Simplicity**, **Absolute Privacy (Local-First)**, and **High Customizability**. It positions itself as a **proactive financial assistant for data laypeople** (not a spreadsheet/BI tool) — see `PRD.md` §1.1 for the target persona and §1.2 for the "anti-table" presentation principle that follows from it. Users import bank statements (CSV/OFX) with minimal manual setup, get on-device ML category suggestions, split transactions across categories/tags, isolate extraordinary expenses into project budgets, and sync across devices via the user's own Google Drive `appDataFolder` — no central server ever sees financial data.

**Day-to-day development scope: Web/Angular (SPA), `src/app/`.** Tauri (desktop) and Capacitor (mobile) configs under `platforms/` now have working CI/CD packaging (see CI/CD & Releases below) — Web/Desktop/Android ship real installers, iOS builds unsigned in CI for verification only. Despite that, **local native development inside `platforms/` stays out of scope unless explicitly asked** — CI packaging existing doesn't mean local Tauri/Capacitor tooling work is invited by default.

The product's working name stays **Poupado** — "Savvy" is a parked rebrand candidate under evaluation (see `.agents/BUSINESS.md`), not a decision; don't rename things preemptively.

## Architecture — Domain-Driven Design

Code under `src/app/` is strictly layered; respect these boundaries when adding or moving code:

- `domain/` — business logic: entities/value objects (`models/`), repository interfaces (`repositories/`), pure domain services (`services/`). No framework dependencies.
- `infrastructure/` — concrete implementations: RxDB adapters/repositories (`rxdb/`), external APIs (`api/`), Google Drive sync (`sync/`).
- `application/` — orchestration: use cases (`use-cases/`), reactive state/facades using Angular Signals and RxJS.
- `ui/` — presentation, organized by **Atomic Design**: `components/atoms/` → `molecules/` → `organisms/`, plus `templates/` (layout) and `pages/` (route-level views wiring templates to real data).

Persistence is **RxDB** (not raw SQLite/IndexedDB directly) — see `src/app/infrastructure/rxdb/`.

## Styling

SCSS under `src/styles/` follows **ITCSS** layering (Settings → Tools → Generic → Elements → Objects → Components → Trumps). Component class names follow **BEM** (`.block__element--modifier`).

## UI/UX — Mobile-First & Design Source

- **Mobile-first, always.** Every screen is designed and implemented for mobile first (390px baseline) and scaled up to tablet/desktop after — never the reverse. This is a hard rule, not a preference.
- The current design source of truth is the Paper Design file **"poupado App"** (`https://app.paper.design/file/01KYYWXKZBF3RDTQ9Y56TEVCDW`) — pages for Dashboard, Movimentos, Importação, Categorias, Gestão de Categorias, Budget, Investimentos & PPR, Diálogos (Split & ML), Definições, Sidenav, and a System Design page with the color/type/spacing tokens and base components. The app is being **rebuilt incrementally** against this design, migrating behavior/animations onto Angular Material components rather than the current ad-hoc styling — page by page, not a single rewrite.

## TypeScript & Clean Code

- Never use `any` — use `unknown` or generics. Prefer `readonly` for arrays/properties. Avoid numeric enums — use union types or `as const`.
- Composition over inheritance, SOLID, single level of abstraction per function, no flag arguments, no side effects, command/query separation.
- Keep files under ~200–300 lines; keep functions small and single-purpose.
- No comments unless explaining a non-obvious architectural decision or a hidden constraint — never restate what the code already says. Comments, when needed, are always in English regardless of conversation language.

## Testing — Spec-Driven TDD

Write or update the corresponding `.spec.ts` before/alongside production code for domain models, services, use-cases, repositories, and components. Follow Red-Green-Refactor. Run `npm run test` to verify. If a module is hard to test, that signals a boundary/abstraction problem — fix the design, not just the test.

## Git Workflow

- The user works exclusively through **GitHub Desktop**, not the terminal, and not Claude. **Never execute any git command that changes repository state** — no `branch`/`checkout -b`, `commit`, `push`, `merge`, `reset`, `tag` create/delete — regardless of how confident or how small the change is, and even if a similar action was approved earlier in the conversation; each one needs its own explicit go-ahead, and even then Claude does not run it, the user does. Claude's job is to **suggest the exact text** (a one-line Conventional Commit message, a branch name) for the user to use themselves in GitHub Desktop. Read-only inspection commands (`git status`, `git log`, `git diff`, `git show`, `git ls-remote`, etc.) are fine without asking — the line is strictly whether the command mutates repo/branch/tag state.
- GitHub Flow: short-lived `feature/*`, `fix/*`, `chore/*` branches off `master` — nested `feature/<big-initiative>/<sub-task>` naming is used for longer-running multi-page initiatives (see `PRD.md` §5 for what's currently active).
- **Conventional Commits** (`type(scope): description`), enforced locally by Husky + commitlint (`commitlint.config.js` extends `@commitlint/config-conventional`).

## CI/CD & Releases

- `ci.yml` runs on every PR: install, unit tests (full per-suite summary), production build.
- `firebase-hosting-pull-request.yml` deploys a per-PR preview to Firebase Hosting.
- **`release.yml` is the single pipeline for everything version-related, and only triggers on a `v*` tag push (or manual `workflow_dispatch`)** — a merge to `master` alone does not release anything. It runs 5 jobs strictly in sequence via `needs:` (a job only starts if the previous one succeeded): `Build` → `Test` → `Deploy Desktop` (macOS/Linux/Windows matrix) → `Deploy Mobile` (Android) → `Deploy Web` (Firebase Hosting, reuses the `Build` job's artifact instead of rebuilding). `Deploy Web` additionally requires a real tag ref (`startsWith(github.ref, 'refs/tags/')`) so a manual dispatch from a branch never touches production.
- GitHub Actions jobs can only `needs:` other jobs in the *same* workflow file — this is why `release.yml` is one file with 5 jobs instead of 3 separate ones. Don't split it back apart without preserving that sequencing.
- Desktop/Android artifacts are attached to a GitHub Release created for that tag (`/releases`) — this is how installers are distributed, since GitHub Pages is unavailable on this private repo's free plan.
- Each job writes its own Job Summary (duration, produced files, links) — check the Actions run's Summary tab first before digging into raw logs.
- Version bumps use `npm run release` (`commit-and-tag-version`): it derives the next semver from Conventional Commit history since the last `v*` tag, updates `package.json`/`CHANGELOG.md`, and creates a local commit + tag — it never pushes. The one-time bootstrap tag (`v0.1.0`, matching the version already in `package.json` before any tag existed) must be created by hand; after that, `npm run release` computes correctly relative to it.
- `npm run release:push` (`git push --follow-tags origin master`) is the separate, deliberate second step that actually publishes the tag and fires `release.yml`. Keeping it as its own command (never chained onto `release`) is intentional — always inspect the generated commit/tag/CHANGELOG before running it, and get explicit user approval first (same rule as any tag push above).

## Domain-specific correctness

- Imported transactions must be deduplicated via a cryptographic hash (date + description + amount) — never import the same statement line twice across overlapping CSV/OFX uploads.
- Transaction splits must always sum exactly to the parent transaction's total amount — treat any mismatch as a bug, not a display rounding issue to shrug off.
- Any feature involving sync, storage, or external data must not weaken the local-first/zero-knowledge guarantee: no financial data leaves the device except through the user's own explicit, encrypted Google Drive sync.
- **The app is an assistant, not an autopilot — it never silently auto-applies a heuristic guess to the user's stored financial data.** Category ML suggestions, bank-signature account matching, internal-transfer detection, budget suggestions, column-mapping detection, etc. may pre-fill or pre-select as a convenience wherever confidence allows, but the write only happens after the user explicitly confirms — never on detection alone. A heuristic that "usually gets it right" is not a substitute for consent: false positives silently corrupting real financial data (e.g. two unrelated transactions coincidentally matching in amount/date and being auto-linked as an internal transfer) are worse than asking. When adding or changing any auto-detection feature, design the confirmation step first, not as an afterthought.
- **Ad SDK boundary:** the app may show non-intrusive ads (AdMob) at fixed screen-transition points. The ad SDK may use the device's advertising ID for personalization, but must **never** have access to RxDB or any financial record — the local-first/zero-knowledge guarantee above is about financial data specifically, not a ban on all network calls. Full monetization strategy lives in `.agents/BUSINESS.md`.

## Related personas

Two deeper personas live under `.agents/skills/` (not auto-loaded — invoke by reading them when the task fits):

- `.agents/skills/finance-agent/SKILL.md` — full engineering persona for this stack (Angular/Tauri/Capacitor/RxDB/on-device ML).
- `.agents/skills/product-owner-assistant/SKILL.md` — market research / competitor benchmarking / needs-elicitation persona, feeds requirements to the engineering side.

## Global skills

These apply here but live outside this repo, in `~/.agents/skills/` (shared source for both Claude and Gemini, symlinked into `~/.claude/skills/`) — they ARE auto-discovered by Claude Code, no manual read needed. Invoke explicitly with the slash command rather than relying on auto-trigger, since their descriptions are generic:

- `code-auditor` — audits Clean Code / DDD / BEM / ITCSS / strict-TypeScript compliance; matches this repo's conventions directly.
- `qa-tester` — writes/reviews Angular unit tests (Vitest/Jasmine), TDD happy-path/negative-path/edge-case coverage.
- `playwright` — E2E test authoring/automation for the web app.
- `web-design` — UI/UX mockups and prototypes, mobile-first then desktop; useful when designing new screens before implementing them in Atomic Design.
- `deploy-agent` — reads this repo's stack (Angular SPA + Tauri desktop + Capacitor mobile under `platforms/`) and proposes a GitHub-first CI/CD + SemVer/Conventional-Commits versioning plan, with draft workflow files, for every platform it detects — even the ones this CLAUDE.md marks as standby. Never pushes, tags, or touches remote state without separate explicit approval.