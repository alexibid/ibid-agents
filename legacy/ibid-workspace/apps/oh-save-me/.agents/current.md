# Oh Save Me! — Current State & Active Work Plan

Single source of truth for the active task and development state of **Oh Save Me!**.

---

## 📍 Current Status

- **Web Platform:** Angular SPA running with full navigation, transaction triage, and insight cards.
- **On-Device ML:** Naïve Bayes merchant categorisation active with user correction overrides.
- **Persistence:** Local RxDB store with encrypted Google Drive backup/sync integration.
- **Platforms (Standby):** Tauri (desktop) and Capacitor (mobile) under `platforms/` remain on standby until web loop iterations are frozen.

---

## 🎯 Active & Next Tasks

1. **Transaction Table & Filters Optimization:**
   - Maintain continuous chain state transitions with no artificial resets.
   - Refactor UI to compose atoms from `libs/ibid-ui`.
2. **Deterministic Stateful Journeys (DSJ):**
   - Ensure mobile viewport (390x844) coverage with seeded database and frozen clock.
3. **Lint Budget:**
   - Maintain zero warnings in `tools/ci/lint-budget.json`.
