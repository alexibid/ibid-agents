# ibid-workspace — Workspace Rules

Rules that apply to **every** project in this monorepo. Anything specific to a single product
lives in that app's own `.agents/AGENTS.md` (for example `apps/oh-save-me/.agents/AGENTS.md`)
and never here.

## 📋 Active work plan: `.agents/current.md`

- `.agents/current.md` is the **single source of truth** for the state and plan of the work in
  progress.
- **Mandatory read:** before proposing changes or running code, read `current.md` to understand
  the context, what is already done, and what the next step is.
- **Keep it current:** update the state as each task is completed and validated.

## 🏗️ Monorepo structure

```
apps/          products, each one independent
libs/          code shared between products
tools/         shared build configuration, and the workspace automation scripts
```

**Dependency rule**, enforced at lint time by `@nx/enforce-module-boundaries`:

- An **app** may import from any **lib**.
- A **lib** never imports from an **app**.
- Between libs, the only allowed dependency is `utils`.

**`libs/` versus `tools/`:** if it is imported by a `.spec.ts` or by application code, it is a
**lib** — it enters the Nx graph and gains an alias, caching, `affected`, and boundary checks.
Everything else that serves the workspace rather than a product is **`tools/`**, whether a
configuration file extends it (`builder/`, `vitest/`, `playwright/`) or an npm script runs it
(`ci/`, `qa/`, `workspace/`, `xbar/`). Language follows the job: `.mjs`, `.sh` and
`.py` all live there.

`libs/utils` is **not** a home for workspace scripts. It is the published `@ibid/utils` package
with its own repository in the split; anything put there ships with it.

**Never duplicate configuration inside an app.** The build engine lives in the `targetDefaults`
of `nx.json`, using the `{projectRoot}` and `{projectName}` tokens. An app's `project.json`
declares only what makes it different.

## 🧭 Working with Nx

- Always run tasks through Nx (`nx run`, `nx run-many`, `nx affected`), never the underlying
  tool directly.
- To understand the impact of a change, use `nx affected` instead of reading through the code.
- Never guess CLI flags: check `--help` or the docs first.
- After changing dependencies between projects, run `nx sync` so the TypeScript project
  references follow the graph.

## 🏷️ Prefixes: the selector says where it comes from

A selector's prefix identifies where the element comes from, so its origin is obvious without
opening a single file.

| Origin | Prefix | Example |
| --- | --- | --- |
| `libs/ibid-ui` | `ibid-` | `<ibid-button>`, `<ibid-header-nav>`, `[ibidHandDrawn]` |
| `apps/oh-save-me` | `ohsaveme-` | `<ohsaveme-transactions-table>`, `[ohsavemeDetectSticky]` |
| `apps/boilerplate` | `boilerplate-` | `<boilerplate-root>` |
| `apps/papikapi` | `papikapi-` | `<papikapi-root>` |
| `apps/papikapi-studio` | `papikapi-studio-` | `<papikapi-studio-root>` |
| Any new app | the app's name | `<renovator-...>` |

**The `app-` prefix is banned across the whole workspace.** It says nothing about origin: in a
monorepo where several apps consume the same library, `<app-card>` does not distinguish the
design system from the product. The same applies to directives and pipes.

The rule is enforced at lint time: every project declares its prefix in `project.json`, and
`@angular-eslint/component-selector` and `directive-selector` reject anything else.

When a component moves up from an app into `ibid-ui`, its prefix moves with it — it becomes
part of the library, and the selector must say so.

## 🧱 Reuse first, create second

Before writing any interface element, **always look in `libs/ibid-ui` for what already exists**
and use it. Writing native HTML (`<button>`, `<input>`, `<select>`, `<dialog>`) inside a
component is allowed only inside the atom that encapsulates it — never in a molecule, organism,
template, or page.

The order is always:

1. **Is there an atom that fits?** Use it.
2. **Does one fit with a new input?** Extend it in the library, with the new input optional and
   the existing behaviour unchanged.
3. **Nothing fits?** Create the atom in `ibid-ui`, with a story and a spec, and only then use
   it. A new element is born in the library, not inside an app.

If an organism needs a raw `<button>`, that is a signal an atom is missing. Real example: a
dismissal scrim started as a `<button>` inside `header-nav`; the right answer was the
`ibid-scrim` atom, now shared by dialogs, bottom sheets, and navigation.

The same applies to styles: use the tokens from `settings/` and the mixins from `tools/`
instead of literal values.

## 💎 Clean Code and TypeScript

- Composition over inheritance, OOP, SOLID, and DRY.
- Files of at most 200–300 lines; small functions with a single responsibility and a single
  level of abstraction.
- Strict TypeScript: never `any` (use `unknown` or generics), prefer `readonly`, avoid numeric
  enums (union types or `as const`), type guards instead of assertions.
- Never return or pass `null`/`undefined` when it is avoidable. Errors are thrown, not returned
  as codes.

### Absolute ban on comments

- Code explains itself through its names. **Writing comments is forbidden.**
- No comments explaining *what* the code does, no tutorials, no dead or commented-out code.
- If a lint rule demands a non-empty block (for example `no-empty`, `no-empty-function`), the
  answer is to **configure the rule** in `eslint.config.mjs`, not to write a comment to satisfy
  it.
- Zero comments in test files: tests document themselves through `it('should...')`.

### Tool-agnostic code

Source code never names design tools (Paper, Figma). Use neutral terms: "Design System",
"Design Tokens", "UI Specifications".

## 🎨 Styles: ITCSS and BEM

- SCSS, with global styles in `libs/ibid-ui/src/styles/` following the ITCSS layers by
  increasing specificity: Settings → Tools → Generic → Elements → Objects → Components →
  Trumps.
- BEM for every component class: `.block`, `.block__element`, `.block--modifier`.
- No overrides outside the `trumps` layer. No deeply nested selectors.

## 🧪 Spec-driven TDD

- Write `.spec.ts` files before or alongside the implementation of components, services, use
  cases, and repositories. Red-Green-Refactor.
- API boundaries are driven by behaviour specifications.
- Cover all business logic.

## 📸 Visual TDD and E2E

### Storybook: one showcase, one product view

| Storybook | Port | Indexes | Command |
| --- | --- | --- | --- |
| `boilerplate` | 6006 | Its own showcase plus every UI library (`libs/ibid-ui`, and future theme libraries) | `npm run storybook:start` |
| `oh-save-me` | 6007 | Only that product's own `ohsaveme-` components, **composing** the boilerplate's | `npm run storybook:product` |

The boilerplate showcases all UI libraries (`libs/ibid-ui`, themes). A product Storybook displays only product-specific components and composes the design system. Stories live alongside their component. Start the boilerplate Storybook first or point `IBID_DESIGN_SYSTEM_STORYBOOK_URL` to a deployed build.

- **Mandatory:** when creating or changing a UI component, create or update its `*.stories.ts`
  and validate coverage in the matching E2E journey.
- **Minimal story boilerplate** — Compodoc extracts the documentation and `argTypes`:

  ```typescript
  import type { Meta, StoryObj } from '@storybook/angular';
  import { MyComponent } from './my-component';

  const meta: Meta<MyComponent> = { component: MyComponent, tags: ['autodocs'] };
  export default meta;
  export const Primary: StoryObj<MyComponent> = {};
  ```

- **Deterministic Stateful Journeys (DSJ):**
  - Focus on the mobile viewport (390x844).
  - No tests against empty data: seed the database and freeze the clock.
  - Cover the full cycle: open → interact (happy path and errors) → dialogs → submit →
    persistence after `page.reload()`.
  - Filters, searches, and selections are tested in a continuous chain, with no artificial
    resets.
  - Every state transition records `recorder.step(n, action, expectedResult)`.
- **Never run watch mode or synchronous servers** (`ng serve`, `vitest --watch`,
  `storybook:start`). Validate with `nx e2e` or `nx build-storybook`, always headless.
- If a screenshot in `test-results/` does not match the expected behaviour, iterate on the
  SCSS/HTML until it does.

## 🌿 Git and versioning

Applies to **every project** in this workspace, without exception.

### Who does what

Committing belongs to the user. They review the code, test what was done, and commit through
GitHub Desktop. The agent writes code and nothing else.

**The agent may use git for reading only:** `git status`, `git diff`, `git log`, `git branch`,
`git show`. It is forbidden from running `git add`, `git commit`, `git push`, `git pull`,
`git merge`, `git rebase`, `git tag`, `git checkout`, `git restore`, `git reset`, or
`git stash` — anything that changes the state of the repository or the index.

### How the agent hands work over

- **Do NOT show commit message proactively:** The agent completes and builds the code. The commit
  message text is provided **ONLY when explicitly requested by the user**.
- **When requested by the user:** The agent inspects `git status` across all submodules and the
  monorepo root (new, modified, and deleted files). When changes span multiple git submodules or
  shared libraries (e.g. `libs/ibid-ui`, `apps/papikapi`, monorepo root), the agent **MUST ALWAYS
  provide the corresponding Conventional Commit for every affected submodule/repository**, plus
  the pointer bump commit for the workspace root when applicable.
- **Default type is `fix`:** By default, changes are classified as `fix(...)` unless they
  represent genuine, substantial new functionality worthy of `feat(...)`.
- **One batch, no file limit.** Read every changed file and hand the whole change over in a
  single batch, however many files it touches.
- **No description, no body, no footer, no git commands.** Single line per commit.

What the agent hands over looks like this:

```
# libs/ibid-ui
fix(ibid-ui): sync textarea native value on input signal update

# apps/papikapi
fix(papikapi): sync diary composer state and align chip selectors in e2e specs

# ibid-workspace (root)
chore(workspace): bump ibid-ui and papikapi submodules
```

### Conventional Commits

`type(scope): description`, validated by Husky and commitlint. The `scope` is the Nx project
name (`oh-save-me`, `boilerplate`, `ibid-ui`, `services`, `testing`, `utils`, `tools`).

### The type determines the version

`commit-and-tag-version` reads the history and derives the version from this:

| Type | Version effect | Used for |
| --- | --- | --- |
| `fix` | **patch** — `0.0.X` | Correcting wrong behaviour (default) |
| `feat` | **minor** — `0.X.0` | Truly new functionality |
| `feat!` or `BREAKING CHANGE` | **major** — `X.0.0` | Breaking compatibility |
| `perf` | patch | Performance improvement |
| `refactor` | patch | Restructuring without behaviour change |
| `docs`, `style`, `test`, `chore`, `ci`, `build` | none | No version bump, no changelog entry |

Choose the type carefully: it decides the version number and what appears in the changelog.

### Branches

`main` is the stable production branch. Develop on short-lived branches — `feature/*`, `fix/*`,
`chore/*` — and integrate through Pull Requests.

## 🔒 Agent files are never committed

`.agents/`, `.claude/`, `.gemini/`, `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` are in
`.gitignore`, both at the root and in every app. Never force these files into the index.

## 🛡️ Terminal Sandbox & Script Execution Invariants

- **Zero Inline Heredocs & Eval**: Never run `cat << 'EOF' > ...`, `echo ... >`, or inline one-liners (`python -c "..."`) via terminal commands. This invalidates Antigravity's prefix-matching and triggers authorization modals.
- **Native File Tools Over Shell**: Create and edit scripts exclusively via native file tools (`write_to_file`, `replace_file_content`).
- **Always Write Inside the Workspace**: ALWAYS write scripts to workspace-local paths under `tools/scratch/<script>.py` inside `ibid-workspace`. NEVER write to paths outside the workspace (`/tmp/`, `~/.gemini/`, `~/Projects/local-models/`). Writing inside `ibid-workspace/tools/scratch/` runs 100% silently with ZERO authorization prompts.
- **Clean Prefix-Matchable Invocations**: Execute scripts strictly by invoking the binary followed directly by the file path (e.g. `python3 tools/scratch/myscript.py`).


## 📦 Workflow and token economy

- Always start by looking at git (`git diff`, `git status`). Only read through the rest of the
  code when strictly necessary.
- Small tasks, small commits.
- **Mandatory build before completion:** Before declaring any task finished, the agent MUST
  always run the build (`npm run build` or `npm run check:build`) to verify that all projects
  compile cleanly without errors.
- **Mandatory validation:** Handing over broken code without proof that it compiles and passes
  its checks is forbidden.

## ✅ Validation: the `npm run check` loop

`npm run check` is the single entry point for validation. It streams execution feedback live,
saves artifacts under `test-results/<projectName>/<device>/<flowName>/`, and maintains
`test-results/last-run.log`.

| Command | Targets | Scope |
| --- | --- | --- |
| `npm run check` / `check:all` | `lint`, `test`, `build`, `e2e`, `test-a11y` | All projects (full suite) |
| `npm run check:fast` | `lint`, `test`, `build` | Affected projects only |
| `npm run check:lint` | `lint` | All projects |
| `npm run check:test` | `test` | All projects |
| `npm run check:build` | `build` | All projects |
| `npm run check:e2e` | `e2e` | All projects |
| `npm run check:a11y` | `test-a11y` | All projects |
| `npm run check:<project>` | `lint`, `test`, `build`, `e2e` | Targeted project |
`nx run-many` per target, streamed and split per project by the prefix Nx puts on every line,
so `test-results/qa/<run>/` holds both `<target>.raw.log` and one `<project>.<target>.log` per project.
`test-results/qa/last/` points at the newest run and the ten most recent are kept.

| Tier | Targets | Runs by default |
| --- | --- | --- |
| `t0` | `lint` | yes |
| `t1` | `test` | yes |
| `t2` | `build` | yes |
| `t3` | `e2e`, `test-a11y` | no — needs `--e2e` or `--tier=t3` |

A failing tier stops the run, so a broken lint never costs four minutes of browsers.

The browser tier always runs one task at a time, whatever `--parallel` says: each app’s
Playwright server binds a fixed port, and `oh-save-me` refuses to reuse a running one.

| Flag | Effect |
| --- | --- |
| *(none)* | scope is `nx affected` |
| `--project=ibid-ui,services` | only these projects |
| `--all` | every project |
| `--tier=lint` or `--tier=t0,t1` | only these tiers |
| `--e2e` | adds the browser tier |
| `--full` | do not stop at the first failing tier |
| `--base=<ref>` | base for `nx affected` |
| `--parallel=6` | concurrent tasks, default 3 |

### Who runs what: strict 5-step development and validation workflow

The development cycle strictly follows these steps:
1. **Code changes**: The agent applies modifications in `libs/ibid-ui` and/or `apps/<app>`.
2. **Mandatory compilation check**: The agent runs `npm run check:build` (or `npm run build`) to ensure clean compilation. The agent is strictly forbidden from running `npm run check:fast` unprompted or running ad-hoc test suites.
3. **E2E validation belongs to the user (`t3`)**: The agent hands over the QA check command pointing at the targeted journey so that tests run through the central runner, updating `test-results/qa/` logs, screenshots, and `summary.md`:
   ```bash
   node tools/qa/check.mjs --project=oh-save-me --tier=e2e --journey=<NN>-<feature>
   ```
   or:
   ```bash
   npm run check:e2e -- <NN>-<feature>
   ```
   The agent NEVER launches browser tiers (`t3`) on its own.
4. **Diagnostic on failure**: If failures occur, the agent consults `test-results/qa/last/summary.md` and the targeted log slice to iterate.
5. **Visual inspection**: Screenshots are placed under `test-results/oh-save-me/<device>/<journey>/` for continuous visual review.

### Reading protocol

This is where the tokens are saved, and it is not optional.

1. Read `test-results/qa/last/summary.md`, and nothing else.
2. Green means done. Never open a log "to confirm".
3. Red: the summary carries a line number into the log. Open **that window only** —
   `sed -n '110,140p' test-results/qa/last/<project>.<target>.log`. Running `cat` over a whole log,
   or piping a target's raw output into the conversation, is forbidden.
4. After a fix, re-run scoped to what changed (`--project=…`), never the whole workspace.

## 💻 macOS Menu Bar Plugin: xbar

`tools/xbar/ibid-runner.10s.sh` provides a native macOS menu bar interface for controlling the
local runner (`actions.runner.alexibid-ibid-workspace.MAC_ALEX`), monitoring builds, and
executing delivery tasks across all products in the workspace:

- **Menu Bar Title**: Pure `.i` template icon with subtle state glyphs (`⟳` compiling, `○` stopped,
  clean icon when active).
- **Workspace Actions**: `check:fast`, `check:build`, deploy all web apps to Firebase Hosting, and
  deliver all native installers to Google Drive (`ibid-builds/`).
- **Product Actions (`oh-save-me`, `boilerplate`, `papikapi`)**:
  - 1-click installer compilation (`.dmg` and Android `.apk`).
  - Desktop installer automatic mounting on install/build.
  - Direct USB Android installation via ADB (`adb install -r`).
  - 1-click Firebase Hosting deployment per application.
  - Quick links to live Web Apps (`https://ibid-ohsaveme.web.app`, `https://ibid-boilerplate.web.app`, `https://ibid-papikapi.web.app`).

Symlink to install in xbar:
```bash
ln -sf "$(pwd)/tools/xbar/ibid-runner.10s.sh" ~/Library/Application\ Support/xbar/plugins/
```

## 🌿 Isolated Worktrees & Multi-Project Workflow

To work on an application without monorepo noise (avoiding mixed `git status` or seeing other apps in your IDE):

```bash
npm run worktree:oh-save-me   # Creates ~/Projects/oh-save-me
npm run worktree:papikapi     # Creates ~/Projects/papikapi
npm run worktree:list         # Lists active worktrees
```

Under the hood, `tools/workspace/worktree.mjs`:
1. Creates a linked Git worktree on its own dedicated feature branch (`feature/<app>-dev`).
2. Configures Git **Cone-mode Sparse-Checkout** so that other applications do not exist on disk in that folder.
3. Symlinks `node_modules` from the monorepo root for instantaneous readiness without extra disk space.
4. Allows opening each app in **GitHub Desktop** (`File -> Add Local Repository`) and **VS Code** (`code ~/Projects/<app>`) as an isolated project.

## 🐙 Standalone repositories on GitHub

Every application and shared library **is its own private repository** under `alexibid`, wired
into the workspace as a git submodule:

`alexibid/oh-save-me`, `alexibid/papikapi`, `alexibid/boilerplate`, `alexibid/papikapi-studio`,
`alexibid/ibid-ui`, `alexibid/services`, `alexibid/testing`, `alexibid/utils`.

They need no publishing step. A submodule already *is* the standalone repository: commit inside
it and push, then bump the pointer in the workspace root.

`tools/` is the exception and stays in the root repository. It is mirrored read-only to
`alexibid/tools` by subtree split:

```bash
npm run split       # push tools/ to alexibid/tools
npm run split:dry   # dry run
```

**`tools/` should not become a submodule.** The root repository's own configuration extends it,
so a clone without `--recursive` would not build; it changes with nearly every workspace change,
which would mean a pointer bump every time; and each app worktree sparse-checks it in, which
only works while it lives in the root history. The subtree mirror gives the standalone
repository without any of that cost.

`tools/ci/split.mjs` refuses to split a path that is a submodule at HEAD — the subtree would
resolve to the snapshot taken before the migration and overwrite the real repository, discarding
every commit made in it since. That guard is why the target list holds only `tools`.

## 🚦 Continuous integration

GitHub Actions is the contract: what passes locally must pass there, and a run that ends amber
is treated as a run that failed. Four workflows chain into one another, and each one draws its
own execution graph in the job summary.

```
CI (pull_request, push to main)
  Setup ──▶ Static (lint · types)
        ──▶ Tests (unit)
        ──▶ Build ──▶ Journeys (e2e · accessibility)
                              ──▶ Report · CI verified
                                          └──▶ Merge (bump/* pull requests only)

CI green on main ──▶ Automatic versioning ──▶ tags ──▶ Release
                                          │             Inspect ──▶ Package (web · android · desktop)
                                          │                     ──▶ Deliver (GitHub · Drive · Hosting)
                                          └──▶ Split (Monorepo Split to 7 standalone GitHub repos)
```

- **One job per concern.** A job is a group of the pipeline, never a script that does everything.
  `CI verified` and `Release verified` fan every group back in and are the only status checks a
  branch rule needs.
- **`Automatic versioning` runs on `workflow_run`, not on `push`.** A commit is only tagged after
  CI has gone green on it. Never move it back to `push`: that tags broken code.
- **`tools/ci/` owns the logic.** Workflow YAML wires jobs together; anything with a condition,
  a loop, or parsing lives in a `.mjs` file there so it can be run and tested locally.
- **The `Merge` job replaces GitHub's auto-merge.** A private repository on the free plan has no
  branch protection, and without required checks GitHub's own auto-merge would land the pull
  request before CI even starts. So the merge is a job that runs after `CI verified`, and only for
  the `bump/*` branches the deploy pipeline opens. It merges with `RELEASE_TOKEN`, never with
  `GITHUB_TOKEN`: a push made by `GITHUB_TOKEN` triggers no workflow, so `main` would never build
  and nothing would ever be released.

### Zero warnings, enforced

`node tools/ci/lint-budget.mjs` lints every project and compares the warning count against the
ceiling in `tools/ci/lint-budget.json`.

- Lint **errors** always fail the build.
- Warnings above the ceiling fail the build, so a change can never add one.
- Fixing warnings means lowering the ceiling in the same commit. **The ceiling only ever goes
  down.** The target is `0`, after which the file becomes a plain strict gate.

The same standard applies to the runner itself: a deprecation notice in a run is a defect to fix,
not noise to scroll past.

### No credential ever enters the repository

`secretlint` scans for credentials off `.secretlintrc.json` at:
- Husky `pre-commit`: staged files on every commit.
- `npm run check:secrets`: workspace on demand.

`npm audit` runs on staged manifests across all lockfiles (including `apps/oh-save-me/platforms/mobile`). High and critical advisories fail the build. Exceptions live in `tools/ci/audit-allowlist.json`. Run manually with `npm run check:audit`. Rotate compromised credentials immediately. Prefer `secretlint-disable` comments for false positives over widening `.secretlintignore`.

### No credential ever reaches a client, and no agent may propose it

**Absolute prohibition, for every agent, with no exception and no "it is restricted anyway".**

A credential is any API key, token, client secret, service account, signed URL or password. The
browser, a Capacitor or Tauri bundle, a service worker, a `public/` asset, an `environment.ts`, a
runtime JSON such as `app-env.json`, a build-time `define` and a published `dist/` are all clients:
anything they carry is readable by anyone who opens DevTools or unzips the package.

- **Never design, suggest, scaffold or "temporarily" use** a flow that ships a credential to a
  client. "Public by nature", "restricted to one API", "referrer restricted" and "it only reads
  public files" are not accepted arguments. Gitignoring the source (`.env`) protects git, not the
  client, and is not a mitigation.
- **When a feature seems to need a credential in the client, stop.** Say so in one sentence and offer
  only designs where the secret stays server-side or does not exist: a proxy or function holding
  the key, a same-origin static host (Firebase Hosting), a credential-free public endpoint, or
  native HTTP. Let the user choose before writing code.
- **Never ask the user to paste a secret in the chat.** Tell them to put it in `.env` or run
  `gh secret set NAME --repo <repo>` themselves. If one is pasted anyway, do not write it into
  any file, do not repeat it, and tell the user to rotate it.
- **If a credential was exposed** (served, committed, pasted, logged), the first answer is to rotate
  it and delete the old one, before any redesign.

### Actions pinned to Node 24 & Self-Hosted Runner Caches

- All GitHub Actions must use Node 24 runtime floor (`actions/checkout@v5`, `actions/setup-node@v5`, `actions/setup-java@v5`, `actions/cache@v5`, `actions/upload-artifact@v6`, `actions/download-artifact@v7`, `nrwl/nx-set-shas@v5`, `softprops/action-gh-release@v3`).
- Shared steps live in composite action `.github/actions/setup-workspace`.
- Self-hosted runner preserves caches locally (`~/.npm`, `~/.cache/nx`, Gradle, Cargo). Always set `package-manager-cache: false` in `actions/setup-node@v5` to prevent network cache overhead.
- **`NX_CACHE_DIRECTORY` and `NX_WORKSPACE_DATA_DIRECTORY` must be set together.** The first holds the
  cache artifacts, the second the database that says what they are. `.nx/` is gitignored, so
  `actions/checkout` deletes the database on every job while the artifacts survive outside the
  workspace. Nx then reports `Unrecognized Cache Artifacts` and every task is a cache miss.
- Use `node tools/ci/flow.mjs` to measure CI step execution times.

### Build state is never committed

`*.tsbuildinfo` and `dist/` are outputs. A committed `tsbuildinfo` makes `tsc --build` believe a
clean CI checkout is already up to date, so it emits nothing, and every project that consumes the
library then fails with `Cannot find module`. `.gitignore` only covers untracked files: a file
already in the index stays tracked, so it has to be removed explicitly.

### Writing a workflow

- Run `actionlint` before handing the change over. It is installed locally.
- The `secrets` context is **not available in `if:`**, at job or step level. Using it there is a
  startup failure, which shows up as a workflow that "ran and failed" on every push with zero
  jobs. Expose the answer as a job output instead (`has_drive`, `has_hosting` in `release.yml`).
- Never hardcode the list of apps or platforms. `tools/ci/release-target.mjs` derives what a tag
  releases from each app's own declaration, so a new app needs no workflow edit.

### Platforms: everything by default, exclusions are declared

An app ships to **every platform it is configured for**. Nothing is opted into. To keep an app
off a platform, tag it in `project.json`:

```json
"tags": ["skip-platform:android"]
```

`papikapi-studio` carries exactly that: it ships web and desktop, and never reaches a phone.

`node tools/ci/platforms.mjs` decides what a release contains, and fails the build on two
conditions:

- **A half-configured platform.** Web needs a `build` target. Desktop needs
  `platforms/desktop/src-tauri`, a `desktop-build` target and the app's `package.json` — that
  last one is what `sync-app-version.mjs` reads, and without it the Tauri build dies after the
  Rust compile. Android needs `platforms/mobile/android`, a `mobile-apk` target and the same
  `package.json`. Any of these present without the others means CD quietly skips the platform.
- **A skip that contradicts the configuration.** If an app is fully set up for a platform and
  still skips it, remove one or the other.

`release-target.mjs` reads this, so `release.yml` needs no edit when an app changes what it
ships. Run it on demand with `npm run check:platforms`; it also runs in CI before the lint
ceiling.

**Bundling a `.dmg` fails while a stale `dmg.*` volume is mounted.** A previous failed bundle
leaves one behind, and `hdiutil` will not create another. `hdiutil detach /Volumes/dmg.* -force`
and rebuild.

- `--yes` and `--skip-publish` are mutually exclusive in `nx release`. Use `--skip-publish`.
- **Push release tags one at a time.** GitHub drops the tag push events when a single push carries
  more than three tags, so `Release` never starts and nothing reaches Hosting or Drive — silently,
  with the tags sitting on the remote. `tools/ci/release.mjs` pushes the branch first and then each
  tag in its own push. Never batch them back into one refspec list.

### Reading a failed run

```bash
gh run list --limit 10
gh run view <id> --log-failed
```

A run with **zero jobs** is a startup failure: the YAML itself is invalid, and `--log-failed`
returns nothing. Lint the workflow instead of hunting through logs.

## 🖥️ Developer Tooling: macOS Menu Bar (xbar)

A workspace runner and monitor is located at `tools/xbar/ibid-runner.10s.sh`.
It integrates with [xbar](https://xbarapp.com/) to provide quick access from the macOS menu bar:
- **Runner daemon control:** start, stop, restart, and inspect the local GitHub Actions runner (auto-detects `actions.runner.*`).
- **Fast checks & builds:** trigger `npm run check:fast` or full workspace compilation.
- **Per-product actions:** build installers (`.dmg`, `.apk`), auto-mount macOS disks, install directly to connected Android devices via ADB (`adb install -r`), and deploy to Firebase Hosting.
- **Live CLI monitor & notifications:** 1-click launch of `gh run watch` in Terminal and native macOS notification banners.
- **Google Drive sync:** sync all generated installers from `dist/` into the local Google Drive repository (`ibid-builds/`).

## 🔍 Mandatory skill lookup

As the first step of analysing a task, read the relevant skills in `.agents/skills/` before
proposing or editing any code. Skipping this is a critical violation.

## 🌍 Language

All documentation, rules, and agent instructions are written in **English**. This includes
`.agents/`, every `README.md`, and code comments where they are exceptionally allowed. Product
copy shown to users is a separate matter and lives in each app's translations.


## 🧪 Testing Invariant: The User Runs All Tests

- **The agent is STRICTLY FORBIDDEN from running tests:** Never execute `nx test`, `npm test`, `npm run check:test`, Vitest, or Playwright.
- **Handover Protocol:** The agent outputs the exact CLI command for the user to run in their terminal (e.g. `npx nx test <scope>`).
- The user executes the test command and pastes any failure output for the agent to fix.
