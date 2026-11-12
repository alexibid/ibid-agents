# Antigravity Workspace Engine — ibid-workspace

Rules that govern Antigravity's behavior across the entire `ibid-workspace` monorepo.
These rules take precedence and are loaded natively into every Antigravity session.

## 🔄 Automatic Context & Memory Synchronization (MANDATORY ON TURN 1)

Before formulating any plan, proposing code changes, or executing commands:
1. **Load Active Project Memory**: Inspect `.agents/current.md` to synchronize the active work plan, recently completed work, and immediate next steps into working memory.
2. **Load Product Rules (if app-scoped)**: If the task targets a specific application (`apps/oh-save-me`, `apps/camila`, `apps/boilerplate`, `apps/kirigami-studio`), read `apps/<app>/.agents/AGENTS.md`.
3. **Keep Project Memory Current**: As each milestone or task is completed and verified, update `.agents/current.md` to reflect the new state, completed items, and next steps.

---

## 🛡️ Inviolable Core Directives

### 1. Git is Strictly Read-Only
- The agent may **ONLY** use git for inspection: `git status`, `git diff`, `git log`, `git branch`, `git show`.
- **Forbidden**: `git add`, `git commit`, `git push`, `git pull`, `git merge`, `git rebase`, `git tag`, `git checkout`, `git restore`, `git reset`, `git stash`.
- Committing belongs exclusively to the user via GitHub Desktop.

### 2. Commit Messages on Explicit Request Only
- **NEVER** output or propose a commit message proactively.
- Provide a single-line ready-to-run command (`git add -A && git commit -m "type(scope): subject"`) **ONLY** when explicitly requested by the user.
- Read `git status` before composing the message. Default type is `fix(...)` unless introducing major new features (`feat(...)`).
- No file limit: one single batch. Output the complete git add and commit command on one line.

### 3. Absolute Ban on Code Comments & English-Only
- **Zero comments in code**: Code must be self-explanatory through naming and structure. No tutorial, explanatory, or dead code comments.
- **Portuguese in code is strictly forbidden**: Under no circumstances should code comments or identifier names be written in Portuguese.
- All documentation, commit messages, and agent artifacts must be written in **English**.

### 4. Mandatory Monorepo Verification Gate
- Before declaring any task finished, the agent **MUST** run `npm run check:build` (or `npm run build`) to ensure clean compilation across all packages.
- Handing over unverified or non-compiling code is strictly forbidden.
- **Do not run `check:fast` unless told to**: The agent is strictly forbidden from executing `npm run check:fast` unprompted.

### 5. Validation Protocol & Browser Tests
- Fast checks (`check:fast`): run ONLY when explicitly told to by the user.
- **Browser tests (tier t3: E2E journeys, accessibility) belong to the user**: The agent NEVER launches browser tiers unprompted. Hand over the command:
  `npm run check:e2e -- <journey>` (or `node tools/qa/check.mjs --project=<app> --tier=e2e --journey=<journey>`).
- Token economy: Always read `test-results/qa/last/summary.md` first. Never read full raw log files; inspect targeted line ranges with `sed -n '<start>,<end>p' <log>` only when errors occur.

### 6. Design System: Reuse First, Create Second
- Always inspect `libs/ibid-ui` before creating any UI element.
- Raw HTML (`<button>`, `<input>`, `<dialog>`) inside application components is strictly forbidden; use the atoms encapsulating them.
- Selector prefixes: `ibid-` for design system, `ohsaveme-`, `camila-`, `boilerplate-` for apps. The `app-` prefix is completely banned.

### 7. Monorepo Split & Isolated Worktrees Architecture
- **Monorepo Split**: Every app, lib, and tool is mirrored to an independent GitHub repo under `alexibid/` (`alexibid/oh-save-me`, `alexibid/tools`, etc.). Sync via `npm run split`.
- **Isolated Worktrees**: Every component can be developed in dedicated directories (`~/Projects/<target>`) using Git cone-mode sparse-checkout and symlinked `node_modules`. Manage via `node tools/workspace/worktree.mjs`.

### 8. Terminal Sandbox, Native File Tools & Script Invocations
- **Zero Inline Heredocs & Eval**: NEVER execute `cat << 'EOF' > ...`, `echo ... >`, or inline one-liners like `python -c "..."` in terminal commands. Doing so breaks Antigravity's prefix-matching and triggers unwanted user authorization modals.
- **Always Use Native Tools**: Create and edit scripts exclusively with native tools (`write_to_file`, `replace_file_content`).
- **Always Write Inside the Workspace**: NEVER write temporary scripts outside of `ibid-workspace` (e.g. into `/tmp/`, `~/.gemini/`, or `~/Projects/local-models/`). ALWAYS write them to workspace-local paths under `tools/scratch/` (e.g. `tools/scratch/<script>.py`). Within the workspace, native file creation executes 100% silently with zero authorization prompts.
- **Clean Prefix-Matchable Execution**: Run scripts strictly by calling the binary with the target file directly (e.g. `~/Projects/local-models/kirigami/venv/bin/python tools/scratch/myscript.py`).


---

## ⚡ Everyday Workspace Commands

| Task | Command |
| --- | --- |
| Fast affected check (lint + test + build) | `npm run check:fast` |
| Full build (all packages) | `npm run build` |
| Full validation (all tiers) | `npm run check:all` |
| E2E targeted journey (user-driven) | `npm run check:e2e -- <NN-journey>` |
| Sync 8 Standalone GitHub Repos | `npm run split` (or `npm run split:dry`) |
| Pull Standalone Repos to Monorepo | `npm run split:pull` |
| List all isolated worktrees | `node tools/workspace/worktree.mjs list` |
| Create all isolated worktrees | `node tools/workspace/worktree.mjs create-all` |
| macOS Menu Bar Runner (xbar) | `tools/xbar/ibid-runner.10s.sh` |

