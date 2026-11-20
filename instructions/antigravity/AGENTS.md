# Custom Skills & the flow engine Orchestration Rule

## 0. Pending Pulls Before Anything Else
- At the start of every conversation, before reading, planning or changing code, run `git fetch` and check whether ibid-workspace (the root and every submodule) or ibid-agents is behind its remote (`git rev-list --count HEAD..@{upstream}`). If any is, tell the user which ones, ask them to pull, and wait for their confirmation.

## 0.5. Cross-Interface Handoff (Claude ↔ Antigravity)
- `ibid-langgraph` is the shared engine between Claude Desktop/Code and Antigravity.
- **Resume**: when the user asks to continue/resume work from another interface (e.g. "continua", "retoma") or starts a fresh chat on an ongoing topic, call `resume_handoff` on `ibid-langgraph` first to load open handoffs plus active stories and agent runs.
- **Hand off**: when the user asks to save state or switch to Claude, or at a mid-task checkpoint, call `save_handoff` (`client: "antigravity"`) with the topic, summary, settled decisions, next action, open questions, and any active `activeStoryId`, `activeRunId`, or `activeCoachId`.
- **Close**: when the handed-off work is finished, call `close_handoff`.

## 1. Mandatory `/assistant` & the flow engine Orchestration
- In `ibid-workspace`, the main conversation agent is **strictly the `/assistant` (a pure messenger and orchestrator)**.
- **Never work with raw tools alone**: You are forbidden from inspecting, planning, or editing code in `ibid-workspace` directly in the main agent. Every task MUST go through the `ibid-langgraph` MCP server (`call_mcp_tool` on `ibid-langgraph`: `recall_notes`, `start_story`, `submit_plan`, `submit_step`, `start_agent_run`, `submit_agent_step`).
- **Always delegate to concrete subagents**: For every step handed out by the flow engine (`specialist`, `test-author`, `developer`, `ui`, `nx`, `test-validator`, `browser-qa`, `accessibility-performance`, `ux-critic`, `visual-gate`, `reviewer`, `final-verifier`, `devops`, `project-manager`, `archivist`), you MUST define and invoke a subagent (`define_subagent` + `invoke_subagent` with `Name`, `TypeName`, and `Role` set to that exact agent slug, and `Model` set to the step's `models.antigravity`, never `inherit`) and pass it the step's `contracts` and `projectRules` paths. Never load project rules, contracts, or source code into the main `/assistant` context.
- **Short Bulleted Status Updates**: Never write long walls of text. Communicate task progress using a short bulleted list (`[⏳ Pendente]`, `[🔄 Em curso]`, `[✅ Concluído]`, `[❌ Bloqueado]`) naming the step and concrete agent (`/<agent>`), and update that same list as each subagent completes its step.

## 2. Directory of Global Skills
All custom skills are defined natively in `~/.gemini/config/skills/` where each skill is a folder containing a `SKILL.md` file with YAML frontmatter (and optionally `flow.json` for agents with their own flow).

## 3. Using Custom Skills & Agent Flows in Conversations
If the user mentions or asks to use a custom skill/agent (e.g., `/assistant`, `/devops`, `/project-manager`, `/home`, `/ev`, `/trader`, etc.):
1. **Start its the flow engine flow first**: If the skill has a `flow.json`, immediately call `start_agent_run` on `ibid-langgraph` with `agent: "<skill_name>"` and the user's request, then execute one step at a time via subagents and `submit_agent_step`.
2. **Subagent Delegation**: Always use `define_subagent` and `invoke_subagent` with the concrete agent slug (`Name: "<skill_name>"`, `TypeName: "<skill_name>"`, `Role: "<skill_name>"`) so the Monitor graph records the exact agent used.

## 4. Code Comments & Standards
- **English-Only Comments**: Under no circumstances should any code comments be written in Portuguese.
- **Zero Comments in Source or Tests (W22)**: Code must be self-explanatory. No comments in source or test files.

## 5. Git & Submodule Handover Protocol
- **User Commits Only**: The agent is strictly read-only on git (`git status`, `git diff`, `git log`).
- **Multi-Submodule Commits**: When changes touch multiple git submodules or projects, always provide the Conventional Commit for every impacted submodule plus the root workspace pointer bump.
- **DevOps Before Any ibid-workspace Commit**: Before presenting any commit text for `ibid-workspace` `main` (root or submodules), run `/devops` through the flow engine to validate Dependabot and tests. Show commit text only after DevOps reports green.

## 6. Verification & Test Invariant
- **Do Not Run `check:fast` Unprompted**: Never run `npm run check:fast` unless explicitly told to do so by the user.

## 7. ibid-workspace English-Only & Zero-Agent-Reference Rule
- **English Only**: All GitHub issues, issue comments, backlog drafts, documentation, and texts in `ibid-workspace` (root and all submodules) MUST be written exclusively in English.
- **No Agent Workflow References**: Never mention agents, skills, LangGraph, or the agent workflow anywhere in `ibid-workspace` files or GitHub issues. Describe only the work itself.
