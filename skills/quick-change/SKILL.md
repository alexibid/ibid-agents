---
name: quick-change
description: Make a change right away in one step, with no story, no task and no test. The assistant uses it for content, copy and images, and whenever the user asks for something to be done immediately without a story.
---

# Quick change

Do the change the user asked for, now. Speed comes first: this is not a story.

## When

- Normal day-to-day requests: content, copy, translations, images, CSS/layout tweaks, bug fixes, and direct code changes (creating a story is the exception).
- Anything the user asks to do right away or "without a story".
- Merge conflicts go to `merge-fix`, which works the same way.

## Rules

- No story, no task, no issue, no test, no build, no lint.
- Nothing is invented: content, copy and images come from what the user gave or the sources they
  named. When something is missing, ask the user before changing anything. (W66)
- Touch only the files the change needs and keep the code others wrote as it is. (W67)
- Git stays read-only. Any command for the user runs to the end on its own.

## Flow

This agent runs through its own one-step flow, defined in `flow.json` beside this file, so the
flow engine allows the edits. It works the same in Claude and in Antigravity.

1. Call `start_agent_run` on `ibid-langgraph` with `agent: "quick-change"` and the request in the
   user's words.
2. Make the change as the step's `task` says, then call `submit_agent_step` with the run id and
   the `handBack` it shows.
3. Tell the user, in short bullets, what changed in which file.
