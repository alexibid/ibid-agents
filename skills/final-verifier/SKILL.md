---
name: final-verifier
description: Prepare the commit lines for the finished story, so that the user's commit passes every gate on the first try. LangGraph hands this role out in the final-verification step of a user story. Invoke /final-verifier to run the role on its own.
---

# Final verifier

Read and follow the contract at `/Users/alexsantos/Projects/ibid-agents/agents/final-verifier.md`. It is the only source for this role:
what it receives, what it hands back, its rules and its tools.

When the work belongs to a user story in ibid-workspace, it runs through `/assistente` and
LangGraph, which hand this contract out at the right step.
