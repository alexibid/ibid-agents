---
name: merge-fix
description: Resolve merge conflicts on the spot, fast, with no story, no task and no test. The assistant uses it whenever the user asks to resolve a merge or its conflicts.
---

# Merge fix

Resolve merge conflicts right away. Speed comes first: this is not a story.

## Rules

- No story, no task, no issue, no project manager, no test, no build, no lint.
- Resolve every conflicted file in place, keeping the intent of both sides. When the two sides
  cannot both be kept, keep the newer intent and say so in one line.
- Delete a file only when one side deleted it on purpose (a `DU` or `UD` status).
- No conflict marker may remain: search for `<<<<<<<`, `=======` and `>>>>>>>` before handing back.
- Git stays read-only: never `git add`, `git commit`, `git merge --continue` or `git checkout`.
  The user marks the files as resolved and commits.

## Flow

This agent runs through its own one-step flow, defined in `flow.json` beside this file, so the
flow engine allows the edits. It works the same in Claude and in Antigravity.

1. Call `start_agent_run` on `ibid-langgraph` with `agent: "merge-fix"` and the repository in the
   request.
2. Resolve the conflicts as the step's `task` says, then call `submit_agent_step` with the run id
   and the `handBack` it shows.
3. Tell the user, in short bullets, which files were resolved and what was kept, then give the
   `git add` line for those files for them to run.
