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

No contract has trials yet, and none has been used on a real story.

The assistant is not here. It is the skill `skills/assistente`, because the user invokes it.

Every contract here also has a skill of the same name in `skills/`, which only points to the
contract. It lets the role be invoked on its own with `/name`, in Claude and in Antigravity.

## Separation

- An agent that produces something never judges it.
- The test author works from the story and never sees the implementation.
- Where a tool can run separate agents, each step runs in its own. Where it cannot, the same
  model takes one role at a time and LangGraph's checks carry the separation.

## Trials

Each contract gains a `trials/<contract>/` folder: a few example tasks with a known right
answer. They are re-run whenever the contract changes, so a change never quietly breaks what
worked.
