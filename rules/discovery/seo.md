# SEO rules

How a website is found on the web. These rules reach every step that plans, tests, builds or
reviews a project whose sheet sets `Discovery` to `seo`. Plan and build for them from the first
line; do not leave them for the audit.

The flow engine runs the `seo-audit` step after the build, over the prerendered pages of the
build output. It audits and never edits. Its verdict is `PASS`, `WARN` or `BLOCK`; a `BLOCK`
sends the story back to `implement` with each problem, its file and how to fix it.

## Rules

| Id | Category | Rule | Checked by |
| --- | --- | --- | --- |
| SEO01 | HINTS | At most 3 `preconnect` hints per page, only for origins the first view uses | `inspectMetadata` |
| SEO02 | HINTS | `preload` only for critical fonts and the single LCP image; the preloaded image has `fetchpriority="high"` | `checkAssetOptimization` |
| SEO03 | HINTS | `fetchpriority="high"` on the LCP resource only, at most one per page | `inspectMetadata` |
| SEO04 | SOCIAL | Open Graph: `og:title`, `og:description`, `og:url`, `og:type`, `og:locale` with one `og:locale:alternate` per other language, `og:image` of 1200x630 that is not an SVG, and `og:image:alt` | `inspectMetadata` |
| SEO05 | SOCIAL | Twitter card: `twitter:card` is `summary_large_image`, with `twitter:image:alt` | `inspectMetadata` |
| SEO06 | SOCIAL | `og:image:alt` is translated into the language of each page | `validateHreflangGraph` (warning) |
| SEO07 | SEO | `rel="icon"`, `rel="apple-touch-icon"`, `rel="manifest"` and `meta name="theme-color"` on every page | `inspectMetadata` |
| SEO08 | SEO | `robots.txt` at the site root, with an absolute `Sitemap:` line | site files |
| SEO09 | SEO | `llms.txt` at the site root | site files |
| SEO10 | SEO | A real 404: `404.html` exists and no catch-all rewrite answers unknown URLs with the app shell and status 200; every prerendered route has its page | site files |
| SEO11 | SEO | One trailing-slash policy, declared in the hosting config; every canonical and hreflang URL follows it | site files, `inspectMetadata` |
| SEO12 | SEO | Files that are not pages (fragments, data, fallbacks) are sent with `X-Robots-Tag: noindex` | site files |
| SEO13 | SEO | Every page has valid JSON-LD; the entity that owns the site declares `sameAs` | `inspectMetadata`, site files |
| SEO14 | SEO | Slugs are short, translated into the language of the page, and never contain `#` | `inspectMetadata`; translation is a warning of `validateHreflangGraph`; length is for the reviewer |
| SEO15 | SEO | hreflang: one entry per language, the page itself included, `x-default`, no duplicates, every target is a prerendered page that points back | `validateHreflangGraph` |
| SEO16 | SEO | One `h1` per page; slug, `h1` and `title` share one primary keyword without being identical | `inspectMetadata` (shared keyword is a warning) |
| SEO17 | A11Y | WCAG 2.2 AA: `html lang` is set and every image has `alt` (empty when decorative); the rest is judged by the accessibility step and the reviewer | `inspectMetadata`, `checkAssetOptimization` |
| SEO18 | CWV | Core Web Vitals: images use `ngSrc`, and only one image per view has `priority`; field metrics are measured by the performance step | `checkAssetOptimization` |

## Severity

- A broken rule is `BLOCK` when the story touches what produces it: a template the story
  changed, or, for the built pages and the hosting config, a file of the sheet's
  `page sources` or the hosting config itself.
- The same problem in what the story does not touch is existing debt. It is reported as `WARN`,
  never blocks the story, and comes back as a follow-up so it is filed under the open SEO epic.
- Heuristic checks (shared keyword, translated slug and alt, card type) are always `WARN`.

## Contract

```ts
SeoIssueSchema = { ruleId: 'SEO01'..'SEO18', severity: 'BLOCK' | 'WARN' | 'INFO',
  category: 'SEO' | 'SOCIAL' | 'HINTS' | 'A11Y' | 'CWV', filePath, message, fixHint }
SeoAuditSchema = { status: 'PASS' | 'WARN' | 'BLOCK', checkedUrls: string[], issues: SeoIssue[] }
```

The schemas live in `langgraph/src/checks/seo/seo-audit-contract.ts`. A project that runs
`seo-audit` gives its sheet an `SEO audit` table with `pages`, `routes`, `hosting`,
`templates` and `page sources`.

## Epic validation

Before an epic of an `seo` project is approved, the project manager lists the rules the work
touches, and every listed rule appears in the acceptance criteria of at least one story.
