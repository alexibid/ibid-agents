# oh-save-me

Personal finance, local-first. **Oh Save Me!** in English, **Oh poupa-me!** in Portuguese.

| Field | Value |
| --- | --- |
| Path | `apps/oh-save-me` |
| Nx project | `oh-save-me` |
| Prefix | `ohsaveme-` |
| Commit scope | `oh-save-me` |
| Scope of work | Web only. `platforms/` is on standby until the user says otherwise |

## Mandatory steps

| Step | When |
| --- | --- |
| `plan`, `author-tests`, `implement`, `build`, `lint`, `rule-checks`, `unit-tests`, `validate-tests`, `review`, `final-verification` | `always` |
| `journey`, `browser-qa`, `accessibility`, `performance`, `ux-critique` | `ui` |

## Checks

| Step | Command |
| --- | --- |
| `build` | `npx nx build oh-save-me` |
| `lint` | `npx nx lint oh-save-me` |
| `unit-tests` | `npx nx test oh-save-me` |
| `journey` | `node tools/qa/check.mjs --project=oh-save-me --tier=e2e --journey=<journey>` |
| `accessibility` | `npx nx test-a11y oh-save-me` |

## Architecture

| Layer under `src/app/` | Holds |
| --- | --- |
| `domain/` | Entities, value objects, rules, repository interfaces. Pure TypeScript |
| `infrastructure/` | RxDB adapters, external APIs, Google Drive sync |
| `application/` | Use cases, signal state, translations |
| `ui/` | `atoms`, `molecules`, `organisms`, `templates`, `pages` |

- RxDB is reached only inside `src/app/infrastructure/rxdb/`. (O04)
- The product name always comes from the `appName` translation key. (O01)

## Domain rules

- Imported transactions are deduplicated by hash of date, description and amount. (O12)
- A transaction's splits sum exactly to the parent amount. A difference is a bug. (O13)
- No financial data leaves the device except through the user's own encrypted Drive sync. (O14)
- The classifier is Naïve Bayes in pure TypeScript inside `domain/`, with no external API. The
  user's own confirmed rules always override the built-in merchant dictionary. (O10)
- Changing a category triggers the batch re-categorisation flow before applying it widely.
- The import assistant recognises a bank by header signature, then by content, then by the
  user's corrections, which become a private template.
- Skipped imports stay pending with a persistent, non-blocking notification.

## Design rules

- The design source is the Paper file `01KYYWXKZBF3RDTQ9Y56TEVCDW`. The visual system is node
  `8KQ-0` and the icon collection is node `IRV-0`. Source code never names the design tool.

- Line art, hand-drawn. The main background is on every page. (O05)
- Use the visible area for data. Tables and charts carry no hand-drawn border.
- On a card the main figure is the largest element. Split dense cards into child cards.
- Icons come only from the collection. A missing icon is flagged, not invented. (O07)
- Every SVG uses `viewBox="0 0 512 512"` and fills its parent. (O06)
- Colours and tokens are never invented. Ask when the design source is unreachable. (O08)
- Prefer a card with the answer already computed over a table. Tables are a last resort. (O09)
- The operational assistant and Smart Insights never share components. (O11)

## Frozen identifiers

Never change these without an explicit decision from the user. (O15)

- `com.savvyjar.app`
- `savvy_google_*` and `savvy_shared_recipients`
- The Firebase project and the production domain
