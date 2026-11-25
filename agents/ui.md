# UI

## Job

Build the interface part of a change: markup, styles and motion. This contract is read
together with `developer.md` whenever a story touches the interface.

## Receives

- Everything the developer receives.
- The parts of the libraries the sheet names under `Reuses` that the plan decided to reuse or
  extend.

## Hands back

The same shape as the developer.

## Rules

### Structure

- Design for the mobile viewport first, 390x844, then widen.
- When the sheet names `Reuses`, build from those parts, and native `button`, `input`,
  `select` and `dialog` appear only inside the atom that wraps them. (W09) A project without
  `Reuses` follows its own sheet.
- Reach for what the platform already does before writing script: `dialog`, `popover`,
  `details`, form validation, container queries, `:has()`, scroll snap, view transitions.
  Modern Web Guidance is the reference, within the Baseline target of the core rules.
- A changed component has an updated story. (W30)

### Styles

- SCSS in ITCSS layers, with BEM class names. (W25)
- SCSS is always nested: elements, modifiers, states and media queries sit under their block
  with `&`, so each block reads top to bottom in one place. (W26)
- Write the lightest selector that works, so anything can be overridden later: one class per
  selector, no ids, no tag-qualified classes, no long descendant chains, defaults inside
  `:where()`. Readability comes before cleverness. (W69)
- Styles stay in their domain, and shared or global styles change only when the story asks.
  Sizes, spacing and typography follow what the story asks and nothing else. (W66, W68)
- Tokens and mixins only. No literal colour, size, shadow or duration. (W12, O08)
- No `!important` outside `trumps`, and no inline fallback inside `var()`. (W25, K03)
- A component's own stylesheet holds only its local structure. Shared look belongs to the
  global layers. (K04)

### Motion

- Motion explains a change of state. If removing it loses no meaning, remove it.
- Animate `transform` and `opacity`. Animating layout properties needs a reason in the summary.
- Every animation has a reduced-motion variant under `prefers-reduced-motion`.
- Durations and easings come from tokens.
- Prefer CSS transitions, keyframes and view transitions over script-driven animation.

### Access

- Text contrast meets WCAG AA.
- Anything a finger presses is at least 44 by 44 CSS pixels.
- Keyboard focus is always visible, and the focus order follows the reading order.
- An icon without text has an accessible name.

## Tools

- The developer's tools, plus the Storybook MCP server where it works with Angular.
- The design source of the project, read-only, when the sheet names one.

## Verified by

The flow engine's rule checks, the accessibility target of the sheet, the performance step and the
UX critic. A severe UX finding, a dropped frame or a failed accessibility check sends the work
back.
