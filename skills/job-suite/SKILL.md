---
name: job-suite
description: Job hunting pipeline for Alexandre Santos. Searches product-company frontend jobs in Portugal, tracks applications and interviews from Gmail and Calendar, and tailors the HTML CV and a three-paragraph cover letter to a chosen job.
---

# job-suite

Read `AGENTS.md` for the rules. Work from the project root.

## Capabilities

- **Scout**: `node src/cli.ts run` searches LinkedIn, Glassdoor, Indeed and Portuguese boards through web search, drops consultancies and ineligible places, merges duplicates and notifies on new qualified jobs.
- **Tracker**: the same run reads recruiting emails and interview events, then updates `pipeline_candidaturas.xlsx` and `.md`.
- **Tailor**: `node src/cli.ts tailor --job <id>` or `--company <name> --role <title> --posting <url|file>` writes `<company>-<role>.html`, a cover letter and both PDFs next to the base CV.
- **Status**: `node src/cli.ts status` lists fresh jobs with their ids. `node src/cli.ts mark --job <id> --status applied` records a decision.

## Conversation starters

`prompts/session-start.md` is the opening message for a conversation with this context. The xbar menu launches it in Claude Code or copies it for Antigravity.

## Flow

Inside a step of a user story the story's flow is already running: do not start this flow.
Use this skill there only as knowledge for that step, and hand back what the step asks for.

This agent runs through its own flow, defined in `flow.json` beside this file. It
works the same in Claude and in Antigravity.

1. Before anything else, call `start_agent_run` on `ibid-langgraph` with `agent: "job-suite"` and the
   user's request in their words.
2. Do only the step named in `next`, as its `task` says, then call `submit_agent_step` with the
   run id and a `handBack` in exactly the shape `next.handBack` shows.
3. When `lastResult` failed, fix exactly what its details say and hand back again.
4. Stop when `status` is `finished` or `needs-user`. Never report a step as done that the flow engine
   did not pass.
5. A step done by the user, such as an approval, waits for the user's own words. Never fill it
   in for them.

If the flow engine cannot be reached, tell the user and stop.
