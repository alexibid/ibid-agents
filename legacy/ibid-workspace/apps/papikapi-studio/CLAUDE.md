# papikapi-studio

Read and obey the app rules before touching anything here. They are mandatory, not optional.

@.agents/AGENTS.md

Prompt rule in one line: the user prompt only describes the subject (identity, colours, markings, taken from the reference image first). Everything technical (stance, plinth, background, facets, shadows, camera) lives in the system block, never in the user prompt. `scripts/common/prompt-guard.ts` enforces it and `scripts/common/prompt-enricher.spec.ts` tests it.
