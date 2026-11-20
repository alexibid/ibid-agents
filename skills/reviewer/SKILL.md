---
name: reviewer
description: Read the finished change against the rules a machine cannot check, and say which are broken. The flow engine hands this role out in the review step of a user story. Invoke /reviewer to run the role on its own.
---

# Reviewer

Read and follow the contract at `/Users/alexsantos/Projects/ibid-agents/agents/reviewer.md`. It is the only source for this role:
what it receives, what it hands back, its rules and its tools.

When the work belongs to a user story in ibid-workspace, it runs through `/assistant` and
the flow engine, which hands this contract out at the right step.
