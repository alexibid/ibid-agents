---
name: issue-review
description: The project manager's review of GitHub. Brings every issue of the workspace repositories in line with the real state of the work, closing what is done, duplicated or obsolete. The assistant runs it automatically only after a confirmed commit (`confirm_commit` / `confirm_epic_commit`), when a pure non-code decision run finishes, when a story is abandoned or changes scope, and at most once a day otherwise (never while a finished story or epic is still awaiting commit confirmation); stage changes are synced by the flow engine without it.
---

# Issue review

Keep GitHub true: every open issue shows where its work really stands, and nothing that is done,
duplicated or obsolete stays open. This is part of the project manager's job, run through its own
flow so it never waits for an approval it does not need.

## Rules

- The user authorised this review to act without asking (2026-11-23): fixing labels, sizes,
  parents and status comments, bringing a body back to the text the user already approved, and
  closing issues as completed, duplicate or not planned.
- New issues and new text still go through `/project-manager`, which shows the exact text first.
- Never delete an issue. Deleting cannot be undone; closing with a reason can. Only delete the
  exact issues the user lists in their own words.
- Close as completed only with evidence: a story that reached `ready-for-commit`, `awaiting-commit`, or `finished`, a commit on the default branch that does the work, or a completed decision run / settled decision (shown by `sync_github`, `agent_run_status`, or `recall_notes`) for a design or decision task issue. Name the evidence in the closing comment (in plain English describing the work or decision settled, never mentioning agents, skills, or LangGraph). Keep the epic open until its stories are committed, and never run issue-review on a repository while a finished story or epic there is still waiting for commit confirmation (`confirm_commit` / `confirm_epic_commit`).
- Close as duplicate only with the link of the issue it repeats.
- Everything written on GitHub is in English and describes only the work. Never mention agents,
  skills, LangGraph, or who does a task.
- Status labels (`status: …`) and the status comment marked `<!-- story-status -->` belong to the
  flow engine. Do not edit them by hand; `sync_github` keeps them right.

## Tools

- `sync_github`, `story_status` and `read_backlog` on `ibid-langgraph`.
- `gh issue list`, `gh issue view`, `gh issue edit`, `gh issue close`, `gh api` for sub-issues.
- `git log` and reading the code, to find the evidence.

## Flow

This agent runs through its own flow, defined in `flow.json` beside this file. It works the same
in Claude and in Antigravity.

1. Call `start_agent_run` on `ibid-langgraph` with `agent: "issue-review"` and the repositories to
   review in the request.
2. Do only the step named in `next`, as its `task` says, then call `submit_agent_step` with the
   run id and a `handBack` in exactly the shape `next.handBack` shows.
3. When `lastResult` failed, fix exactly what its details say and hand back again.
4. Stop when `status` is `finished` or `needs-user`.

If the flow engine cannot be reached, tell the user and stop.
