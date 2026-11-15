# Poupado — Business & Monetization Context

> This file is reference material for agents (mainly `.agents/skills/product-owner-assistant/SKILL.md`), not a product/engineering document. `PRD.md` and `MVP.md` stay product/engineering-only — see the ad SDK boundary rule in `.agents/CLAUDE.md` for the one place this crosses into engineering.

## Naming

- **Working name: Poupado.** Not renamed. Decided 2026-08-05.
- **"Savvy" is a parked rebrand candidate**, not a decision — under evaluation, revisit closer to public launch when more is known (domain availability, trademark, SEO data). Other candidates surfaced but not pursued: Money Jar, SaavyJar, PoupaJar, Mealheiro Smart.
- Rationale for waiting: pre-launch (no MAU yet) is the cheapest point to switch a name; there's no rush to lock it in before it's actually needed.

## Monetization Model

- **Zero subscriptions / paywalls.** The app stays 100% free to use — no feature gating.
- **Ads (AdMob), non-intrusive placement only:** shown exclusively at screen-transition points (boot/splash, post-task dead zones — e.g. after finishing an import). Zero interruptions during daily navigation or expense entry.
  - **Hard engineering constraint:** the ad SDK may use the device's advertising ID for ad personalization, but has zero access to RxDB or any financial record. See `.agents/CLAUDE.md` → Domain-specific correctness.
- **Complementary revenue (Year 2, not MVP scope):** local affiliate marketing (energy/insurance/financial product savings simulators) and advertising on the financial-literacy blog (see Content Hub idea in `PRD.md` §6).
- **Expected net margin:** >90% — no cloud infrastructure or server costs (local-first architecture, no backend to run).

## Revenue Targets & Market Sizing

Target: ~1.000€/month from transition-point ads alone (~15 sessions/month/user, ~2 impressions/session):

| Market | eCPM | MAU needed |
|---|---|---|
| Portugal / Europe | ~3,00€ | ~22.000 MAU |
| Brazil / LatAm | ~1,00€ (R$6,00) | ~66.000 MAU |
| Global mix (PT+BR+EN) | ~2,00€ | ~33.000 MAU |

**Why 22.000 MAU in Portugal is considered reachable:**
1. ~4,1M households in Portugal — 22.000 users is ~0,5% (1 in 200 homes).
2. Shared features (e.g. a shared shopping list, see `PRD.md` §6) mean **one household installs on 2+ phones** → 2 MAU per household for ad purposes. Real target reduces to ~11.000–15.000 households.
3. Two organic growth loops: household virality via the shared shopping list, and organic search traffic via the financial-literacy blog (Content Hub idea, `PRD.md` §6).

## Competitive Differentiation (vs. Spendee and similar)

- No dependency on paid bank aggregators (Open Banking/Salt Edge) — zero recurring third-party cost.
- Absolute privacy: no centralized server ever stores bank statements.
- Local on-device ML categorization + native multi-category transaction splitting (once FR-10 ships).
