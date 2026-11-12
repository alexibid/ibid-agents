# Rebrand: Kirigami → Papikapi

Status: **planning closed, ready for execution.** All open questions below are resolved; no code
changed yet — execution starts once Phases 1–2 (GitHub repo renames + submodule path surgery,
user-only) are done, so Phase 3 onward operates on the final paths.

## Decisions confirmed with the user (2026-09-28)

- `apps/camila` → **`apps/papikapi`** (the parent-facing family app).
- `apps/kirigami-studio` → **`apps/papikapi-studio`** (the internal model-creation studio).
  They stay two separate Nx apps/submodules for now. The studio is expected to move inside
  `papikapi` later, behind parent authentication (biometrics/PIN) — when that merge happens,
  its components move into the `papikapi-ui` namespace at that time, per the existing
  "prefix moves with the component" rule. Not part of this rebrand.
- Selector prefixes: `papikapi-` for the app, `papikapi-studio-` for the studio — kept distinct
  now (two separate Nx projects), to be collapsed only when the studio actually merges into the
  app. Both already share `libs/ibid-ui` and the same design tokens, so no visual/style work is
  needed for "same styles" — that already holds structurally.
- The `alexibid/camila` and `alexibid/kirigami-studio` GitHub repositories are renamed too, to
  `alexibid/papikapi` and `alexibid/papikapi-studio`. GitHub repo renames auto-redirect the old
  name, but `.gitmodules`, CI, and tooling URLs are updated to the new name regardless.
- The style/LoRA keyword `papikapi-style` is already settled (see memory
  `papikapi-style-name.md`) and needs no change — it never was `kirigami`.

## What "Kirigami" / "Camila" currently mean in this codebase (inventory)

1. **`apps/kirigami-studio`** — the Nx app itself. Project name `kirigami-studio`, prefix
   `kirigami`. ~12 files/dirs with `kirigami` in their name, ~31 files with the word in content
   (docs, `pipeline.json`, `project.json`, component selectors like `<kirigami-process-loader>`,
   `<kirigami-model-creator>`, agent docs under `.agents/`).
2. **`apps/camila`** — the Nx app itself. Project name `camila`, prefix `camila`. ~18 files/dirs
   named `camila`, ~60 files with the word in content (docs, `theme.config.ts`, SCSS files,
   `app.spec.ts`, e2e journeys, and a **built Android bundle** under
   `platforms/mobile/android/app/src/main/assets/public/*.js` — a build artifact, regenerate
   rather than hand-edit).
3. **A shared design-system theme named "kirigami"** in `libs/ibid-ui/src/themes/kirigami.scss`
   and `libs/ibid-ui/src/themes/kirigami/` (`_tokens.scss`, `_backdrop.scss`,
   `_feature-display.scss`, `_controls.scss`, `_paper.scss`). This is the papercraft visual theme
   consumed by `camila` (`theme.config.ts`, `styles.scss`) and by `boilerplate`
   (`theme.config.ts`, showcase spec). It must become the `papikapi` theme — it is a different
   surface from the two app renames above and easy to miss.
4. **`libs/services/src/lib/theme/theme.mock.ts`** and **`theme.service.spec.ts`** hardcode the
   theme id `'kirigami'` and its label `'Kirigami'`.
5. **Workspace root tooling and docs** referencing either name:
   `.gitmodules`, `package.json`, `package-lock.json`, `README.md`,
   `tools/ci/runpod-stats.mjs`, `tools/ci/flow.mjs`, `tools/ci/deploy-pipeline.mjs`,
   `tools/ci/prs.mjs`, `tools/workspace/worktree.mjs`, `tools/workspace/setup-submodules.mjs`,
   `tools/xbar/ibid-runner.10s.sh`, `.firebaserc` (hosting target `camila` / site `ibid-camila`),
   `firebase.json` (`"target": "camila"`, `"public": "dist/camila/browser"`).
6. **Not in scope:** the string `"Camila"` inside two `apps/oh-save-me` spec fixtures
   (`TFI Camila Duarte`, a fake transaction description) is an unrelated personal name in test
   data, not the product name. Leave untouched.

## Phased plan

### Phase 0 — Freeze inventory (done above)
Re-run the greps right before executing, since both submodules have uncommitted changes right
now (`git status` shows modified files in both) — the count may shift.

### Phase 1 — GitHub repo renames (user-only, outside this session)
`alexibid/camila` → `alexibid/papikapi`, `alexibid/kirigami-studio` → `alexibid/papikapi-studio`.
Done directly on GitHub (repo Settings → rename). GitHub keeps the old name as a redirect, but we
still repoint everything in Phase 2 rather than rely on it.

### Phase 2 — Submodule/path surgery (user-only — this is git state, the agent's git access is
read-only per workspace rules)
For each submodule: update the `url` in `.gitmodules` to the new GitHub name, then move the
working path (`apps/camila` → `apps/papikapi`, `apps/kirigami-studio` → `apps/papikapi-studio`).
The clean sequence is `git mv` of the submodule path plus `git submodule sync`, or a deinit /
edit `.gitmodules` / re-`init`+`update` cycle — whichever the user prefers; both need real git
write commands the agent won't run. `tools/workspace/setup-submodules.mjs` may need its submodule
list updated to match.

### Phase 3 — Inside `apps/papikapi-studio` (ex kirigami-studio)
- `project.json`: `name`, `prefix` (`kirigami` → `papikapi-studio`), any hardcoded paths.
- `package.json`: package `name`.
- Angular selectors/component files: `kirigami-process-loader` → `papikapi-studio-process-loader`
  (or the equivalent chosen component name), `kirigami-model-creator` → …, and their `.ts/.html/
  .scss/.spec.ts/.stories.ts` filenames, per the existing BEM/atomic conventions.
- `pipeline.json`, `scripts/**`, `PIPELINE.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`,
  `GEMINI.md`, `qa-stages.md`, everything under `.agents/` — text and any `kirigami`-named keys.
- `e2e/**` journeys and fixtures referencing the app or its selectors.
- Rebuild the Android/desktop platform artifacts rather than hand-editing the generated JS/CSS
  bundles under `platforms/`.

### Phase 4 — Inside `apps/papikapi` (ex camila)
- `project.json` (`name`, `prefix`), `package.json` (`name`).
- `theme.config.ts` and any component referencing the `kirigami` theme id → `papikapi`.
- SCSS files listed above (`home.page.scss`, `sheet.page.scss`, `diary.page.scss`,
  `paper-model.scss`, `app.scss`, `styles.scss`) — check whether "kirigami" there is the theme
  class name or just a comment/import path.
- Docs: `PRD.md`, `MVP.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`.
- `e2e/journeys/01-shell.journey.spec.ts`, `app.spec.ts`.
- Regenerate `platforms/mobile/android` build output; do not hand-edit the bundled `.js`/`.css`.

### Phase 5 — Shared theme in `libs/ibid-ui`
- Rename `src/themes/kirigami.scss` → `papikapi.scss` and the `src/themes/kirigami/` folder →
  `papikapi/` (all five partials), updating the `@forward`/`@use` paths and the theme's internal
  BEM/token names if they embed the word.
- Update whatever central theme registry/import list in `ibid-ui` points at the old path.

### Phase 6 — `libs/services` theme wiring
- `theme.mock.ts`: id `'kirigami'` → `'papikapi'`, label `'Kirigami'` → `'Papikapi'`.
- `theme.service.spec.ts`: every `'kirigami'` literal and the `bodyClasses()`/`localStorage`
  assertions that key off it.
- `apps/boilerplate` showcase spec and `theme.config.ts` that reference the theme id.

### Phase 7 — Workspace root tooling, CI, hosting
- `.gitmodules` (already covered in Phase 2, verify final state).
- `package.json` / `package-lock.json`: script names (`worktree:camila` → `worktree:papikapi`?),
  workspace paths.
- `README.md` (root).
- `tools/workspace/worktree.mjs`: app list / branch names (`feature/camila-dev` → …).
- `tools/workspace/setup-submodules.mjs`: submodule table.
- `tools/xbar/ibid-runner.10s.sh`: menu labels, live-URL links, per-product build actions.
- `tools/ci/runpod-stats.mjs`, `tools/ci/flow.mjs`, `tools/ci/deploy-pipeline.mjs`,
  `tools/ci/prs.mjs`: any hardcoded app-name strings, plus `tools/ci/release-target.mjs` and
  `tools/ci/platforms.mjs` since they derive release targets from app folder names — confirm they
  pick the new names up automatically (they're supposed to be name-agnostic per `AGENTS.md`) and
  fix any that aren't.
- `.firebaserc`: hosting target `camila` → `papikapi`, site `ibid-camila` → `ibid-papikapi` (a
  Firebase Hosting site rename may require creating a new site rather than renaming — check
  Firebase console capabilities before assuming a simple string swap is enough).
- `firebase.json`: hosting target block (`"target": "camila"`, `"public": "dist/camila/browser"`).
- Root `.agents/AGENTS.md` prefix table (the one listing `ibid-`, `ohsaveme-`, `boilerplate-`) —
  add `papikapi-` and `papikapi-studio-`, drop the old `kirigami-`/`camila-` rows.
- Root `.agents/current.md` — the "Done" log already narrates recent work as "Papikapi" in prose
  even though the code still says Kirigami; no change needed there (it's a historical log), but
  new entries after this rebrand should use the final names.

### Phase 8 — Sweep and verify
- Re-run the case-insensitive greps for `kirigami` and (scoped to the product, not the
  `oh-save-me` fixtures) `camila` across the whole workspace; the only acceptable remaining hits
  should be the old GitHub redirect URL if intentionally left as a fallback, and historical prose
  in `current.md`.
- `npm run check:build` (mandatory before handing over, per workspace rules).
- Hand the lint/test/e2e commands to the user to run (git and test execution stay theirs):
  `npx nx affected -t lint test build`, `npm run check:e2e -- <journey>`.

### Phase 9 — Handover
- Batches of at most 10 files per commit, one Conventional Commit line per affected
  submodule/repo plus the root pointer-bump commit, provided **only when the user asks for it**
  (per `feedback-commit-handover`). Likely batches: `papikapi-studio` (several batches, it has the
  most files), `papikapi` (several batches), `ibid-ui` (theme rename), `services` (theme wiring),
  root (`tools/`, `.gitmodules`, `.firebaserc`, `firebase.json`, `README.md`).

## Open questions — resolved (2026-09-28)

1. **Component names:** direct prefix swap, nothing else changes. `kirigami-process-loader` →
   `papikapi-studio-process-loader`, `kirigami-model-creator` → `papikapi-studio-model-creator`,
   and the same rule for every other `kirigami-*` selector found in Phase 3 (file names,
   `selector:` in the `@Component` decorator, `.spec.ts`/`.stories.ts` titles, e2e references).
2. **Firebase Hosting:** rename in place — `.firebaserc` target `camila` → `papikapi`, site
   `ibid-camila` → `ibid-papikapi` — not a new site provisioned alongside the old one.
3. **No legacy continuity:** everything moves to the new name in this same pass — script names
   (`worktree:camila` → `worktree:papikapi`), branch-name templates
   (`feature/camila-dev` → `feature/papikapi-dev`), etc. Nothing old is kept "for now".

## Git attribution (2026-09-28, applies to this whole workspace from now on)

No agent/AI attribution of any kind in git: no `Co-Authored-By` trailer, no agent name in commit
messages, branch names, or PR descriptions/footers — for this task and every task in
`ibid-workspace` going forward, regardless of which agent (Claude Code, Antigravity, etc.) does
the work. Commit-message handover per [[feedback-commit-handover]] stays plain Conventional Commit
lines only.

## Explicitly out of scope

- The `TFI Camila Duarte` fixture strings in `apps/oh-save-me` (unrelated test data).
- Any change to `SavvyJar`/`oh-save-me` itself.
- Merging the studio into the `papikapi` app — that is future work once parent authentication
  (biometrics/PIN) exists; only the name changes now.
