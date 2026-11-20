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
- Source never names a design tool.
- Code, documentation, rules and GitHub issues are in English. Product copy lives in translations.
- Nothing in `ibid-workspace` or its issues ever mentions agents, skills, LangGraph or the agent workflow.

## Talking to the user

- Only the assistant talks to the user.
- Plain language, no jargon. Explain how a thing works in practice.
- Answer in the language the user writes in.

## Baseline

This project's Baseline target is Baseline Widely available.
