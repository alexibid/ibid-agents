# Agents

One contract per agent. A contract is everything an agent needs to do one job, and nothing
about any other job. LangGraph names the contracts to read with every step it hands out.

## Shape of a contract

Every contract has the same six sections, in this order.

| Section | Says |
| --- | --- |
| Job | The single thing this agent does, in one or two sentences |
| Receives | What it is given: story, brief, files, earlier results |
| Hands back | The exact shape LangGraph expects |
| Rules | Only the rules that bear on this job, with their ids from `rules/rule-table.md` |
| Tools | What it may use, and what it may not |
| Verified by | How its work is checked, and by whom |

## Contracts

| Contract | Step | State |
| --- | --- | --- |
| `specialist.md` | `plan` | First version, from `solution-architect` |
| `developer.md` | `implement` | First version |
| `ui.md` | `implement`, when the interface changes | First version; absorbed `design-system-specialist` |
| `test-author.md` | `author-tests` | First version; absorbed `qa-tester` and `playwright` |
| `test-validator.md` | `validate-tests` | First version |
| `browser-qa.md` | `browser-qa` | First version; absorbed `playwright` |
| `accessibility-performance.md` | `performance` | First version |
| `ux-critic.md` | `ux-critique` | First version |
| `visual-gate.md` | `visual-gate` | First version; absorbed `visual-qa` and its scripts |
| `reviewer.md` | `review` | First version; absorbed `code-auditor` |
| `final-verifier.md` | `final-verification` | First version |
| `nx.md` | `plan`, and `implement` when workspace files change | First version, from the Nx skills |
| `archivist.md` | Before the story, and whenever something is concluded | First version |

None has been used on a real story yet.

The assistant is not here. It is the skill `skills/assistant`, because the user invokes it.

Every contract here also has a skill of the same name in `skills/`, which only points to the
contract. It lets the role be invoked on its own with `/name`, in Claude and in Antigravity.

## Separation

- An agent that produces something never judges it.
- The test author works from the story and never sees the implementation.
- Where a tool can run separate agents, each step runs in its own. Where it cannot, the same
  model takes one role at a time and LangGraph's checks carry the separation.

## Evaluations

The user's own agents with a LangGraph flow keep their evaluation cases in
`skills/<agent>/evals.json`: a request, the step the run must reach, and what the answer must
and must not say. `npm run evals -- <agent>` in `langgraph/` runs each case through the Claude
command line, checks that the agent went through its flow, and keeps the result, which the
dashboard shows. Agents that touch the user's accounts, files or programs have no automatic
evaluation.
