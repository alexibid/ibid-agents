# Custom Skills Integration Rule

## 0. Pending Pulls Before Anything Else
- At the start of every conversation, before reading, planning or changing code, run `git fetch` and check whether ibid-workspace (the root and every submodule) or ibid-agents is behind its remote (`git rev-list --count HEAD..@{upstream}`). If any is, tell the user which ones, ask them to pull, and wait for their confirmation.

## 1. Directory of Global Skills
All custom skills are defined natively in ~/.gemini/config/skills/ where each skill is a folder containing a SKILL.md file with YAML frontmatter.

## 2. Using Custom Skills in Conversations
If the user mentions or asks to use a custom skill/agent (e.g., @casa, @ev, @trader, etc.) or requests to run a task using one of these:
1. **Locate the definition**: Read ~/.gemini/config/skills/{skill_name}/SKILL.md.
2. **Execute/Adopt**:
   - You can adopt the role/prompt directly in the current chat.
   - Alternatively, you can define a subagent using the `define_subagent` tool with the name, description, and system prompt parsed from the SKILL.md file, and then call `invoke_subagent`.

## 3. Built-in Native Compatibility
Both the Antigravity desktop/web chat and the CLI `agy` natively load skills from ~/.gemini/config/skills/ without requiring any manual JSON compilation or custom sync scripts.

## 4. Code Comments & Standards
- **English-Only Comments**: Under no circumstances should any code comments be written in Portuguese. They MUST always be written in English.
- **Self-Explanatory Code**: Code must be self-explanatory. Comments should be kept to the absolute bare minimum, and only used to explain complex logic, trade-offs, or decisions. Do not comment on obvious code.

## 5. Git & Submodule Handover Protocol
- **User Commits via GitHub Desktop**: The agent is strictly read-only on git (`git status`, `git diff`, `git log`).
- **Multi-Submodule Commits**: When changes touch multiple git submodules or projects (e.g. apps, shared libs, root monorepo), whenever the user requests commit messages or suggestions, the agent MUST ALWAYS provide the corresponding Conventional Commit for **every** impacted submodule/repository, as well as the root workspace pointer bump commit when applicable.
- **DevOps Before Any ibid-workspace Commit**: Before presenting any commit text for the ibid-workspace `main` (root or submodules), the agent MUST run `/devops` to validate Dependabot and the tests. The commit text is shown only after DevOps reports green; on a failure, show what failed and give no commit text.

## 6. Verification & Test Invariant
- **Do Not Run `check:fast` Unprompted**: The agent is strictly forbidden from running `npm run check:fast` unless explicitly told to do so by the user. For build/compilation verification, use `npm run check:build` or `npm run build`.


