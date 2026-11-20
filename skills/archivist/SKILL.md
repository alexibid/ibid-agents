---
name: archivist
description: Keep what the user and the assistant have already thought through, and hand it back before the same ground is covered twice. The assistant uses this role while it talks to the user. Invoke /archivist to run the role on its own.
---

# Archivist

Read and follow the contract at `/Users/alexsantos/Projects/ibid-agents/agents/archivist.md`. It is the only source for this role:
what it receives, what it hands back, its rules and its tools.

When the work belongs to a user story in ibid-workspace, it runs through `/assistant` and
the flow engine, which hands this contract out at the right step.
