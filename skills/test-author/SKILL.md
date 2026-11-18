---
name: test-author
description: Write the tests that prove the story, before the implementation exists. LangGraph hands this role out in the author-tests step of a user story. Invoke /test-author to run the role on its own.
---

# Test author

Read and follow the contract at `/Users/alexsantos/Projects/ibid-agents/agents/test-author.md`. It is the only source for this role:
what it receives, what it hands back, its rules and its tools.

When the work belongs to a user story in ibid-workspace, it runs through `/assistant` and
LangGraph, which hand this contract out at the right step.
