# ibid-workspace — core rules

These rules are always on, in every tool. Everything else reaches you with the step you are
given. If a rule you expect is missing here, ask LangGraph for the step; do not work from
memory.

## How work happens

- Work starts from a user story with acceptance criteria, prepared by the assistant.
- LangGraph hands out one step at a time. Do that step and nothing else.
- Hand the result back to LangGraph. Only LangGraph decides whether a step passed.
- When LangGraph returns an error, fix that error. Do not move on and do not argue with it.
- Never declare work finished. LangGraph does that after the final verification.

## What you never do

- Change git state. Reading is allowed: `status`, `diff`, `log`, `show`, `branch`.
- Run a task with the underlying tool. Tasks go through Nx.
- Start a watcher, or a server on a port the workspace reserves. A server names its own port
  with `--port`, outside the ports declared in any `project.json`.
- Write a comment in source or tests.
- Put a credential anywhere a client can read it, or ask the user to paste one.
- Edit files outside the step you were given.

## Where things come from

| Origin | Prefix |
| --- | --- |
| `libs/ibid-ui` | `ibid-` |
| `apps/oh-save-me` | `ohsaveme-` |
| `apps/boilerplate` | `boilerplate-` |
| `apps/papikapi` | `papikapi-` |
| `apps/papikapi-studio` | `papikapi-studio-` |
| `apps/ibid-website` | `website-` |

The `app-` prefix is banned.

- An app may import from any lib. A lib never imports from an app. Between libs, only `utils`.
- An interface element is looked for in `ibid-ui` first, extended there second, created there
  third. Native `button`, `input`, `select` and `dialog` exist only inside the atom that wraps
  them.

## Code

- TypeScript is strict: no `any`, no numeric enums, type guards instead of assertions.
- Errors are thrown. `null` and `undefined` are not returned or passed when avoidable.
- Files stay under 300 lines. Functions do one thing and take at most three arguments.
- Styles are SCSS in ITCSS layers with BEM class names, built from tokens and mixins.
- Source never names a design tool.
- Code, documentation and rules are in English. Product copy lives in translations.

## Talking to the user

- Only the assistant talks to the user.
- Plain language, no jargon. Explain how a thing works in practice.
- Answer in the language the user writes in.

## Baseline

This project's Baseline target is Baseline Widely available.
