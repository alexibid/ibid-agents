# ibid-agents (Private & Confidential)

Private multi-agent orchestration, governance, and audit system across all user workspaces (`ibid-workspace`, `lemon-mart`, `local-weather-alex`, etc.).

---

## 1. Why This Repository Exists (Context & Rationale)

- **Zero Product Contamination**: Keeps product repositories 100% clean of vendor-specific AI prompts, rules, agent files, and scaffolding. Governance lives entirely at the user account level (`~/.gemini/config/` and `~/.claude/`).
- **Context Rot & Token Blowout Elimination**: Massive monorepos degrade LLM reasoning when hundreds of rules and files are loaded into a single chat. This system isolates every job into focused contracts and subagents.
- **Elimination of Self-Grading Bias**: Models that author implementation never author or validate their own tests.
- **Deterministic State Machine**: Powered by the **flow engine** (reached via MCP as `ibid-langgraph`), work moves through strict, non-skippable gates in two phases: building (`plan` → `implement` → `author-tests` → `build` → `lint`) and, only when the user asks to commit, verifying (`rule-checks` → `unit-tests` → `validate-tests` → `journey` → `browser-qa` → `ux-critique` → `review` → `final-verification`). Repeats that cannot change the result are skipped, and an agent that is not sure asks instead of guessing.
- **Active Enforcement & Auditing**:
  - **Guard Hooks (`PreToolUse`)**: Deny state-changing git commands, forbidden test runners, unassigned ports, and edits outside active flows.
  - **Desktop Monitor (Angular + Tauri + PostgreSQL)**: Audits real agent calls, token expenditure, rate limits, and flow execution.

---

## 2. Core Architecture: How It Operates

```
[ User ]
   ▲
   │ (plain language & short bullet status updates)
   ▼
[ /assistant ] (Pure Messenger — Never touches code)
   │
   ├─► [ ibid-langgraph MCP ] (Owns sequence, rules & gates)
   │         │
   │         ├─► Step 1: Specialist (Plan)
   │         ├─► Step 2: Test Author (Blind TDD)
   │         ├─► Step 3: Developer / UI (Implementation)
   │         ├─► Step 4: Machine Gates (Build / Lint / Rules / Tests)
   │         ├─► Step 5: Test Validator & Browser QA (Verification)
   │         ├─► Step 6: Reviewer & DevOps (Auditing & CI)
   │         └─► Step 7: Final Verifier (Conventional Commits)
   │
   └─► [ Guard Hook ] (Blocks illegal edits, git writes, & port collisions)
```

---

## 3. Roster of Agents: What They Do & What They Cannot Do

### Orchestration & Knowledge

- **`/assistant` (or `/assistente`)**
  - **Does**: Single user contact point. Turns requests into user stories, starts flows, delegates steps to isolated subagents, reports progress in short bulleted lists.
  - **Forbidden**: Reading source code, editing files, running project commands, building without the flow engine, skipping story approval.

- **`/archivist`**
  - **Does**: Manages persistent institutional memory in PostgreSQL (`recall_notes`, `remember_note`, `list_open_notes`).
  - **Forbidden**: Editing source code, inventing unrecorded facts, running git commands.

---

### User Story Lifecycle (the flow engine Core Roles)

- **`/specialist`**
  - **Does**: Plans the exact files to touch, declares triggered conditions (`ui`, `behaviour`, `figures`, `workflows`), reuses `ibid-ui` elements, and writes the technical brief.
  - **Forbidden**: Writing source code, modifying unplanned files, assuming external APIs exist without checking contracts.

- **`/test-author`**
  - **Does**: Right after the developer, writes the fewest specs (`.spec.ts`) that prove each criterion, at the lowest layer, on mocked data only (at most two per criterion); at the commit, fixes only what the unit tests or the validator fault.
  - **Forbidden**: Reading the implementation's internals, authoring production code, writing inline mock data (K01), reaching a real API or database (T02).

- **`/developer`**
  - **Does**: Implements logic strictly within the planned files, keeping functions small (SRP) and files under 300 lines; in the commit phase, fixes what the tests or the review report.
  - **Forbidden**: Inventing anything the story did not ask for (W66), changing code the user or another agent wrote that the change does not need (W67), sharing styles across domains or changing shared styles unasked (W68), flat SCSS or heavy selectors (W26, W69), touching files outside the plan, writing comments (W22), using `any` (W17), changing git state.

- **`/ui`**
  - **Does**: Builds markup, styles (SCSS/ITCSS/BEM), tokens, and motion for user interfaces.
  - **Forbidden**: Using native HTML controls outside atoms (W09), writing overrides outside `trumps` (W25), naming design tools (W24), writing business logic.

- **`/nx`**
  - **Does**: Inspects and updates monorepo project graphs, dependencies, tags (`scope:*`, `type:*`), generators, and task targets.
  - **Forbidden**: Bypassing Nx with direct raw CLI tools (`vitest`, `tsc`, `ng`, `eslint`) (W05).

- **`/test-validator`**
  - **Does**: Proves, criterion by criterion, that tests genuinely fail without the change and pass with it.
  - **Forbidden**: Authoring production code, accepting tests that pass vacuously, modifying criteria.

- **`/browser-qa`**
  - **Does**: Runs the application on a dedicated port, exercises journeys as a user, verifies zero console errors, captures screenshots.
  - **Forbidden**: Writing application code, ignoring visual glitches or console warnings.

- **`/accessibility-performance`**
  - **Does**: Audits WCAG contrast/ARIA and measures live browser traces for dropped frames and layout shifts (CLS).
  - **Forbidden**: Approving screens that drop animation frames or violate Baseline Widely Available.

- **`/ux-critic`**
  - **Does**: Evaluates screens from the user's perspective, reporting severity-ranked usability flaws with screenshot evidence.
  - **Forbidden**: Writing application code, softening high-severity usability defects.

- **`/visual-gate`**
  - **Does**: Compares rendered 3D models and figures against reference artwork with part-by-part verification.
  - **Forbidden**: Overruling measured geometric/visual deviations by visual inspection alone (K05).

- **`/reviewer`**
  - **Does**: Audits git diffs against architectural rules (ITCSS, SRP, DDD, file lengths, comments, no hardcoded secrets).
  - **Forbidden**: Authoring fixes, waiving blocking findings, judging own contributions.

- **`/final-verifier`**
  - **Does**: Runs pre-commit gates (`commitlint`, `secretlint`), computes Conventional Commit commands per affected submodule, validates through `/devops`.
  - **Forbidden**: Running `git commit` or `git push` (user executes commands), bundling multi-submodule commits into a single commit line.

---

### Autonomous Specialists with Dedicated Flows (`flow.json`)

- **`/devops`**
  - **Does**: Diagnoses and fixes GitHub Actions workflows, runners, Dependabot updates, and delivery scripts until green.
  - **Forbidden**: Loosening or deleting CI gates, editing application business logic directly.

- **`/project-manager`**
  - **Does**: Groups work into epics of at least 8 stories (the unit of a commit), reusing an open epic of the same project or theme; splits them into small stories (`S`/`M`) with acceptance criteria; creates English GitHub issues upon approval.
  - **Forbidden**: Starting implementation, writing issues referencing internal agent workflows or the flow engine (W61).

- **`/issue-review`**
  - **Does**: The project manager's review of GitHub: after a commit, on scope changes and at most once a day, brings every open issue in line with the code and closes what is done, duplicated or obsolete, with the evidence.
  - **Forbidden**: Deleting issues, writing new issue text without approval, editing the `status: …` labels the flow engine owns.

- **`/quick-change`**
  - **Does**: Makes content, copy, image or "urgent, no story" changes in one step.
  - **Forbidden**: Opening a story, task or issue, running tests, inventing content.

- **`/merge-fix`**
  - **Does**: Resolves merge conflicts on the spot in one step, keeping both intents.
  - **Forbidden**: Opening a story, task or issue, running tests, builds or lint, changing git state.

- **`/solution-architect`**
  - **Does**: Analyzes multi-project architectures, diagnoses structural flaws, designs end-to-end integration contracts.
  - **Forbidden**: Writing production code directly (advises and designs only).

- **`/coach`**
  - **Does**: Guides Angular 22 & Clean Code learning with bite-sized outside-in lessons; verifies student exercises.
  - **Forbidden**: Writing student solution code directly, skipping verification steps.

- **`/business-analyst`**
  - **Does**: Evaluates market opportunities, competitor benchmarks, ASO, SEO, and YMYL/E-E-A-T compliance with dated sources.
  - **Forbidden**: Editing code, making unsubstantiated market claims without primary references.

- **`/product-owner-assistant`**
  - **Does**: Elicits requirements and benchmarks local-first personal finance applications (Oh Save Me!).
  - **Forbidden**: Designing technical database schemas or writing application code.

- **`/finance-agent`**
  - **Does**: Engineers local-first Angular + RxDB features following `ibid-ui` and domain isolation rules.
  - **Forbidden**: Calling remote APIs with private financial data (O14), importing RxDB outside infrastructure (O04).

- **`/web-design`**
  - **Does**: Designs mobile-first UI/UX mockups, design tokens, and Paper components.
  - **Forbidden**: Writing backend services or bypassing the atomic design system.

- **`/deploy-agent`**
  - **Does**: Prepares deployment topologies, environment variable strategies, and release manifests.
  - **Forbidden**: Executing live production deployments without explicit user confirmation.

- **`/blender`**
  - **Does**: Automates headless Blender 5.2 LTS (`bpy`/`bmesh`) geometry scripts and TripoSR image-to-3D reconstructions.
  - **Forbidden**: Modifying application web UI code or manually tweaking meshes without scripts.

- **`/home`**
  - **Does**: Diagnoses local IoT devices, Zigbee/Home Assistant networks, and smart-home configurations.
  - **Forbidden**: Exposing local home automation networks to unauthenticated public endpoints.

- **`/ev`**
  - **Does**: Mediates electric vehicle condominium charging installations under Portuguese law (DL 93/2025).
  - **Forbidden**: Providing non-compliant electrical or legal advice outside verified statutes.

- **`/job` & `/job-suite`**
  - **Does**: Tracks frontend engineering applications in Portugal and tailors structured HTML CVs and cover letters.
  - **Forbidden**: Falsifying technical credentials, submitting applications autonomously.

- **`/trader` (Suite: `trader-analyst`, `trader-hunter`, `trader-strategist`, `trader-worker`)**
  - **Does**: Orchestrates portfolio management (60% core strategy, 40% swing trading), reads sheets, formats Google Sheets pipelines.
  - **Forbidden**: Executing real financial trades with real funds, altering formula sheets outside designated worker ranges.

---

## 4. Operational Invariants

1. **Pending Pulls First**: Every conversation checks `git fetch` across the root workspace and submodules before any read or write.
2. **Read-Only Git**: Agents never commit, push, or alter git branches. All commits are executed manually by the user.
3. **No Agents in Commits or Issues**: Product commits, issues, and code comments never mention agents, skills, or LangGraph.
4. **Short Bullet Status**: Task progress is always communicated in single updated bullet lists (`[⏳ Pendente]`, `[🔄 Em curso]`, `[✅ Concluído]`, `[❌ Bloqueado]`).
