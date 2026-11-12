# Papikapi Studio — 3D Generation, Unfolding & Prompting Rules

This document is the authoritative source of truth for **Papikapi Studio** (`apps/papikapi-studio`) and applies exclusively to `papikapi` and `papikapi-studio`.

---

## 🎨 AI Generation & Prompting Invariants (FLUX & Papikapi Studio)

### Strict Separation Invariant: User Prompt vs System Prompt (CRITICAL)
Under NO circumstances may system prompt directives leak or be injected into the user prompt. They serve two entirely disjoint roles:

- **USER PROMPT (Pure Subject Description Only):**
  - Represents strictly what the user requested or what the subject looks like (identity, species, body colors, and specific visual markings).
  - Contains ONLY the subject's anatomy and physical markings:
    * Example: *"a cute standing bicolor black and white cat, black head cap with an asymmetrical vertical white blaze on the nose bridge extending between the eyes towards its left eye, solid white muzzle and cheeks with a distinct black nose tip, white chin with a small black spot beneath the lower lip, large solid white chest bib extending down the belly, jet-black back and body, white socks on all four paws, pale yellow-green eyes with round white catchlights"*
  - **PROHIBITED IN USER PROMPT:** Never include technical posture rules, camera rules, papercraft material constraints, or lighting instructions (e.g. zero floor shadow, flat on the ground plane, low-poly cardstock facets, zero whiskers).

- **SYSTEM PROMPT (Studio Technical & Physical Invariants Only):**
  - Contains all 3D engine, physical origami folding, posture, lighting, and child-safety constraints:
    * Posture & Stance: *"standing naturally on all four paws flat on the ground plane, exactly four legs and four paws (or exactly two legs for bipeds)"*
    * Background & Lighting: *"zero floor shadow, zero cast shadow, completely seamless flat neutral light grey #E5E5E5 background"*
    * Papercraft Geometry: *"pure low-poly papercraft cardstock facets with clean planar folds, 100% closed geometric volumes, fine details painted flat as 2D UV texture decals"*
    * Child Folding & Safety: *"all muzzles and cheeks are completely smooth, bare, and clean cardstock without facial markings, zero thin antennae, zero needle spikes, and zero thin protruding strands (zero whiskers)"*
    * Studio Signature: *"cute expressive eyes with circular white catchlights and vibrant paper colors"*

---

## 👁️ Visual QA Quality Gate & Integrity Invariants (`@visual-qa`)

### Holistic Figure Fidelity & Zero Complacency Protocol (CRITICAL)
Under NO circumstances may any agent claim or report a "PASS" or "ACEITE" without adhering strictly to the following invariants:

1. **Holistic Figure Inspection (All Details, Not Just Eyes):**
   - The inspection MUST evaluate the ENTIRE figure across 360 degrees:
     * Eyes, pupils, and catchlights (must strictly match FLUX art: pupils centered, round white catchlights).
     * Muzzle, nose tip, lips, and nostrils (sharp decals, clean white fur without dirty grey/black pixel bleeding).
     * Facial markings, blaze, cap, and ear color transitions.
     * Chest, bib, belly, back, and tail patterns.
     * All 4 paws individually (socks, toes, markings).
   - If **ANY SINGLE ELEMENT** on the figure fails, deviates, bleeds, blurs, or is missing, the verdict is strictly **❌ REJEITADO (FAIL)**.

2. **Mandatory Image Inspection (`read_file` Invariant):**
   - It is strictly forbidden to emit an audit verdict without invoking the `read_file` tool on the rendered audit image (`/tmp/audit_head.png`, `/tmp/audit_front.png`, etc.) in the exact same turn.
   - Any claim of "PASS" or "ACEITE" made without reading and visually inspecting the rendered artifact is considered fraudulent and completely void.

3. **Separation of Duties & Subagent Delegation:**
   - The developer agent modifying the code is never the sole judge of its own quality.
   - Quality inspection must be executed via `@visual-qa` with visual evidence presented in full before concluding any task.
