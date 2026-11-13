---
name: visual-gate
description: Stop any figure or model that does not match its reference art from reaching the user. LangGraph hands this role out in the visual-gate step of a user story. Invoke /visual-gate to run the role on its own.
---

# Visual gate

Read and follow the contract at `/Users/alexsantos/Projects/ibid-agents/agents/visual-gate.md`. It is the only source for this role:
what it receives, what it hands back, its rules and its tools.

When the work belongs to a user story in ibid-workspace, it runs through `/assistente` and
LangGraph, which hand this contract out at the right step.
