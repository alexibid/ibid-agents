# ibid-ui — Current State & Active Work Plan

Single source of truth for the active task and development state of **libs/ibid-ui**.

---

## 📍 Current Status

- Core atoms implemented: `button`, `chip`, `card`, `scrim`, `textarea`, `icon`, `input`.
- Core organisms implemented: `header`, `header-nav`.
- Full Storybook showcase active on port 6006 (`npm run storybook:start`).
- Compilation clean (`nx build ibid-ui`) and tests passing (`nx test ibid-ui`).

---

## 🎯 Active & Next Tasks

1. **`ibid-textarea` CVA Refactor:** Make `ibid-textarea` a true `ControlValueAccessor` driven by `FormControl`.
2. **Design Tokens Expansion:** Expand Kirigami and hand-drawn theme mixins in `styles/tools/`.
