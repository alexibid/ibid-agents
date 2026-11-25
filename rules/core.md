# ibid-workspace — core rules

These rules are always on, in every tool. Everything else reaches you with the step you are
given. If a rule you expect is missing here, ask the flow engine for the step; do not work from
memory.

## Before anything else

- At the start of every conversation with the user, before reading, planning or changing code,
  run `git fetch` and check whether ibid-workspace (the root and every submodule) or ibid-agents
  is behind its remote (`git rev-list --count HEAD..@{upstream}`). If any is, tell the user which
  ones, ask them to pull, and wait for their confirmation.
- A subagent handed a step by the flow engine skips this check: the conversation that started the story
  already did it.
- When the user asks to resume work started in another interface (Claude or Antigravity) or when an
  active handoff notice is shown at session start, call `resume_handoff` on `ibid-langgraph` first.
  When pausing, switching interfaces, or reaching a checkpoint mid-conversation, call `save_handoff`
  so the other interface can pick up without repeating context; call `close_handoff` once the work is done.

## How work happens

- Work starts from a user story with acceptance criteria, prepared by the assistant.
- The flow engine hands out one step at a time. Do that step and nothing else.
- Hand the result back to the flow engine. Only the flow engine decides whether a step passed.
- When the flow engine returns an error, fix that error. Do not move on and do not argue with it.
- Never declare work finished. The flow engine does that after the final verification.

## What you never do

- Change git state. Reading is allowed: `status`, `diff`, `log`, `show`, `branch`.
- Run a task with the underlying tool. Tasks go through Nx.
- Start a watcher, or a server on a port the workspace reserves. A server names its own port
  with `--port`, outside the ports declared in any `project.json`.
- Write a comment in source or tests.
- Put a credential anywhere a client can read it, or ask the user to paste one.
- Edit files outside the step you were given.
- Invent what the user did not ask for: requirements, behaviour, copy, content, images, data or
  APIs. When a decision is missing, hand back `questions` and change nothing. (W66)
- Change code that the user or another agent wrote and the change does not need: no refactor,
  rename, reformat, reorder or clean-up of working code. Touch only the lines the change needs. (W67)
- Give the user a command that waits for input or opens a pager. Every command you hand over runs
  to the end on its own (`-y`, `--force` where safe, `GIT_PAGER=cat`) and says roughly how long it
  takes.

## Where things come from

Selectors and pipes carry the prefix named in the project sheet's `Prefix` field. The `app-`
prefix is banned.

- An app may import from any lib. A lib never imports from an app. Between libs, only `utils`.
- In a project whose sheet names `ibid-ui` under `Reuses`, an interface element is looked for
  in `ibid-ui` first, extended there second, created there third, and native `button`,
  `input`, `select` and `dialog` exist only inside the atom that wraps them.

## Code

- TypeScript is strict: no `any`, no numeric enums, type guards instead of assertions.
- Errors are thrown. `null` and `undefined` are not returned or passed when avoidable.
- Files stay under 300 lines. Functions do one thing and take at most three arguments.
- Styles are SCSS in ITCSS layers with BEM class names, built from tokens and mixins.
- SCSS is always nested: elements, modifiers, states and media queries sit under their block
  with `&`, so a block reads top to bottom in one place. (W26)
- Selectors stay as light as possible so anything can be overridden later: one class per
  selector, no ids, no tag-qualified classes, no long descendant chains, defaults inside
  `:where()`, and `!important` only in trumps. (W69)
- Each domain keeps its own styles. A change stays inside its component and never alters shared
  or global styles unless the story asks for it. (W68)
- Source never names a design tool.
- Code, documentation, rules and GitHub issues are in English. Product copy lives in translations.
- Nothing in `ibid-workspace` or its issues ever mentions agents, skills, LangGraph or the agent workflow.

## Talking to the user

- Only the assistant talks to the user.
- Plain language, no jargon. Explain how a thing works in practice.
- Answer in the language the user writes in.

## Baseline

This project's Baseline target is Baseline Widely available.
