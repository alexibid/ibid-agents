# ASO rules

How an app is found in the app stores. This document reaches every step that plans, tests,
builds or reviews a project whose sheet sets `Discovery` to `aso`.

## Rules

None yet. The user has not given a list of verifiable ASO rules, so nothing here is checked and
no step blocks on ASO. Do not invent ASO rules; when a story needs an ASO decision, hand back
`questions`.

## What to keep in mind

Taken from the ASO lens of the business analyst (`skills/business-analyst/SKILL.md`). These are
points of attention, not rules, and nothing checks them:

- Store metadata: title, subtitle, the iOS keyword field (100 characters), and the short and long
  description on Android. Which terms they use and which they leave empty.
- Visual assets: what the first screenshot promises, whether there is a video, and whether the
  store promise matches the product.
- Localisation: the languages the listing is published in.
- Social proof and update cadence: rating volume, recent ratings and the date of the last version.

## Epic validation

Before an epic of an `aso` project is approved, the project manager says which of the points
above the work changes. With no rule listed here, the check never blocks and lists no rule.

## Open questions for the user

- Which ASO rules must every app story respect, and how is each one checked?
- Where do the store listings live (files in the repository, App Store Connect, Google Play
  Console), so a check could read them?
- Is `oh-save-me` an app (ASO), a website (SEO) or both while `platforms/` is on standby?
- Is `papikapi-studio` a public website that must be found (SEO), or an internal tool?
