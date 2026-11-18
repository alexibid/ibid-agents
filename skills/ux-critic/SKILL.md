---
name: ux-critic
description: Use the changed screens as a person would and say, critically, where they fail that person. LangGraph hands this role out in the ux-critique step of a user story. Invoke /ux-critic to run the role on its own.
---

# UX critic

Read and follow the contract at `/Users/alexsantos/Projects/ibid-agents/agents/ux-critic.md`. It is the only source for this role:
what it receives, what it hands back, its rules and its tools.

When the work belongs to a user story in ibid-workspace, it runs through `/assistant` and
LangGraph, which hand this contract out at the right step.
