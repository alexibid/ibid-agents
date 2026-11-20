# papikapi

Papercraft origami progression for parents and children. App-first and voice-first.

| Field | Value |
| --- | --- |
| Path | `apps/papikapi` |
| Nx project | `papikapi` |
| Prefix | `papikapi-` |
| Commit scope | `papikapi` |
| Specialist | `agents/papikapi-specialist.md` |
| Reuses | `ibid-ui` |
| Delivery | iOS and Android through Capacitor, macOS through Tauri, with a browser fallback for development |

## Mandatory steps

| Step | When |
| --- | --- |
| `plan`, `author-tests`, `implement`, `build`, `lint`, `rule-checks`, `unit-tests`, `validate-tests`, `review`, `final-verification` | `always` |
| `journey`, `browser-qa`, `accessibility`, `performance`, `ux-critique` | `ui` |
| `visual-gate` | `figures` |

## Triggers

| Condition | Files |
| --- | --- |
| `figures` | `.glb`, `.gltf`, `.blend`, `.obj`, `figures/` |

A code model under `domain/models/` is not a figure and never triggers `figures`.

## Agents

Project agents the flow engine brings into a step, beside its generic agents.

| Agent | Step | When | Contract |
| --- | --- | --- | --- |
| `blender` | `implement` | `figures` | `skills/blender/SKILL.md` |

## Checks

| Step | Command |
| --- | --- |
| `build` | `npx nx build papikapi` |
| `lint` | `npx nx lint papikapi` |
| `unit-tests` | `npx nx test papikapi` |
| `journey` | `node tools/qa/check.mjs --project=papikapi --tier=e2e --journey=<journey>` |
| `accessibility` | `npx nx test-a11y papikapi` |

## App-first

- Never assume a web-only API exists or behaves the same inside a WebView. (P01)
- Microphone, audio, speech, haptics and storage go through a native bridge, with a clean
  browser fallback. (P02)

## Voice-first

- Every input surface offers dictation as a first-class option. (P03)
- Dictation allows sessions up to 60 seconds, does not block the screen, and gives the user
  three controls: record or resume, stop, accept.
- Speech is shown in the language spoken so the user can review it.
- Translation to the canonical language happens in the background on submit, never while the
  user is speaking. (P04)

## Generation prompts

- The user prompt carries only the subject: identity, colours, markings.
- Stance, background, lighting, facets and child-safety constraints live in the system prompt.
- Nothing from the system prompt ever leaks into the user prompt. (P05)

## Game rules

- Figures keep their initial catalog order on every shelf, whatever happens. (P06)
- A thumbnail fills continuously from 0% to 100% with the points earned, matching
  `SHIPPED_FIGURE_PIECE_COUNTS`. Switching figures loses no progress. (P07)
- Selecting a figure is immediate: no timer, no loading delay, no outline flicker. (P08)

## Packaging

- Tauri configuration: `apps/papikapi/platforms/desktop/src-tauri/tauri.conf.json`.
- Installer: `node tools/builder/sync-app-version.mjs --project papikapi`, then
  `npx nx desktop-build papikapi`. Output in `dist/papikapi/`.
