---
name: papikapi-studio-specialist
description: Plan every papikapi-studio story and orchestrate the generic and project agents that carry it out. The flow engine hands this role out in the plan step of a papikapi-studio user story. Invoke /papikapi-studio-specialist to run the role on its own.
---

# papikapi-studio specialist

Read and follow the contract at `/Users/alexsantos/Projects/ibid-agents/agents/papikapi-studio-specialist.md`. It is the only source for this role:
what it receives, what it hands back, its rules and its tools. It composes `/Users/alexsantos/Projects/ibid-agents/agents/specialist.md`.

When the work belongs to a user story in ibid-workspace, it runs through `/assistant` and
the flow engine, which hands this contract out at the right step.
