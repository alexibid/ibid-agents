---
name: browser-qa
description: Use the running app the way the story describes and report whether it behaves that way. LangGraph hands this role out in the browser-qa step of a user story. Invoke /browser-qa to run the role on its own.
---

# Browser QA

Read and follow the contract at `/Users/alexsantos/Projects/ibid-agents/agents/browser-qa.md`. It is the only source for this role:
what it receives, what it hands back, its rules and its tools.

When the work belongs to a user story in ibid-workspace, it runs through `/assistant` and
LangGraph, which hand this contract out at the right step.
