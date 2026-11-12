# Papikapi — System Architecture, Product & Workspace Rules

This document is the single, authoritative source of truth for the **Papikapi** application within the **ibid-workspace** monorepo. It is automatically discovered and loaded into the agent's system prompt on every conversation turn.

---

## 📱 App-First & 🎙️ Voice-First Core Directives (CRITICAL)

### 1. App-First Architecture (Capacitor & Tauri Native Packaging)
- **Papikapi is an App-First product**, NOT a generic browser website.
- Primary delivery targets are **mobile apps (iOS & Android via Capacitor)** and **desktop (macOS via Tauri)**.
- **Native Runtime Invariant:** Never assume web-only APIs (such as browser-specific `window.webkitSpeechRecognition` or unconstrained browser permissions) exist or behave identically inside mobile WebViews (`WKWebView` on iOS/macOS, Android WebView).
- **Native Bridge Requirement:** All hardware/device capabilities (Microphone, Audio, Speech-to-Text, Haptics, Local Storage) must be designed to integrate with native plugins (`@capacitor-community/speech-recognition`, native platform bridges) while keeping a clean browser fallback for local web dev/testing.

### 2. Voice-First Interaction Model
- **Papikapi is Voice-First.** Both parents and children interact with the application primarily through spoken words rather than typing on a keyboard.
- **Frictionless Voice Capture:**
  - Every input surface (Figure prompt generation, Behavior/Diary logging, parental notes) must offer speech dictation as a primary, first-class citizen.
  - Dictation supports extended listening sessions (up to 60 seconds), non-blocking recording states, and explicit user controls: **Gravar/Retomar**, **Parar**, and **Aceitar**.
- **Local Language Review & Silent Submit Translation:**
  - Dictation occurs in the user's spoken language (e.g., Portuguese `pt-PT`).
  - Transcribed text is displayed directly in the input field in the spoken language so the user can review and edit naturally.
  - Translation and canonical structure (PT -> EN) occurs strictly **in the background upon submit**, never in real-time inside the input field while speaking.

---

## 🏛️ Monorepo Structure & Total Workspace Access

`apps/papikapi` is a child app within the `ibid-workspace` monorepo:
```
apps/
  papikapi/            papercraft origami progression product
  papikapi-studio/     AI 3D generation & papercraft unfolding studio
  oh-save-me/          financial tracking product
  boilerplate/         design system showcase & shared host
libs/
  ibid-ui/             shared design system & UI components
  services/            shared services (i18n, storage, auth)
  testing/             shared test helpers
  utils/               pure utility functions
tools/                 workspace configuration, CI, and QA runner
```

### Prefix Rules
- `libs/ibid-ui`: `ibid-` (e.g. `<ibid-button>`, `<ibid-card>`, `[ibidHandDrawn]`).
- `apps/papikapi`: `papikapi-` (e.g. `<papikapi-assembly-stage>`, `<papikapi-figure-thumbnail>`).
- **The `app-` prefix is strictly banned** across the entire workspace.

---

## 🎨 AI Generation & Prompting Invariants (FLUX & Papikapi Studio)

### 1. Strict Separation Invariant: User Prompt vs System Prompt (CRITICAL)
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

## 🏆 Game Domain & Progression Invariants

### 1. Catalog Shelf Stability
- Figures maintain their **exact initial catalog order** across all shelves at all times.
- Switching figures, gaining points, or completing figures MUST NEVER reorder, sort, or shift the positions of the thumbnails on the shelves.

### 2. Continuous Piece-Accurate Progress Fill
- Thumbnails clip smoothly from 0% to 100% based on continuous point accumulation matching `SHIPPED_FIGURE_PIECE_COUNTS`.
- No arbitrary pip quantizations or loss of progress when toggling between figures.

### 3. Immediate Selection
- Selecting or switching figures on the shelf must be instantaneous (zero timers, zero loading delays, zero temporary outline flickers).
- The 3D canvas stage transitions smoothly while shelf state reflects selection immediately.

---

## 🖥️ Desktop (Tauri) & Packaging Protocol
- Tauri builds are configured in `apps/papikapi/platforms/desktop/src-tauri/tauri.conf.json`.
- Distribution DMG installers are generated via:
  ```bash
  node tools/builder/sync-app-version.mjs --project papikapi
  npx nx desktop-build papikapi
  ```
- Output location: `dist/papikapi/papikapi.<version>.dmg`.
- For macOS local testing without Apple Developer notarization, strip quarantine flags:
  ```bash
  xattr -cr /Users/alexsantos/Downloads/papikapi.<version>.dmg
  xattr -cr /Applications/papikapi.app
  ```
