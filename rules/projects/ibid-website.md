# ibid-website

The author's public site, read like a book in four languages, and a showcase of Angular practice
that complements the CV. Static pages built from a content snapshot; the admin runs only locally.

| Field | Value |
| --- | --- |
| Path | `apps/ibid-website` |
| Nx project | `ibid-website` |
| Prefix | `website-` |
| Commit scope | `ibid-website` |
| Specialist | `agents/ibid-website-specialist.md` |
| Delivery | Static web on Firebase Hosting (site `ibid-website`, project `ibid-32cbe`) plus the contact Function |

## Mandatory steps

| Step | When |
| --- | --- |
| `plan`, `author-tests`, `implement`, `build`, `lint`, `rule-checks`, `unit-tests`, `validate-tests`, `review`, `final-verification` | `always` |
| `browser-qa`, `ux-critique` | `ui` |
| `browser-qa` | `behaviour` |

The project has lint and test targets. Tests are written and validated only when the user asks
to move on to the commit. `accessibility`, `performance` and `journey` join `ui` once story S9 adds the
e2e target.

## Checks

| Step | Command |
| --- | --- |
| `lint` | `npx nx lint ibid-website` |
| `unit-tests` | `npx nx test ibid-website` |
| `build` | `npx nx build ibid-website` |

## Content

- The site reads its content only from `src/content/content.snapshot.json`, through
  `SnapshotContentRepository`. Nothing in the site talks to a CMS, an API or a database.
- The snapshot changes only inside a story; the brief says why and which pages change.
- Routes come from the snapshot at bootstrap. Never rebuild `router.config` at runtime.

## Configurations

- `production` is the published build and `development` the local one. There is no separate
  admin build.
- The admin routes (`admin`, `admin/login`) work on the snapshot repository only: what they
  create, change or delete is never persisted.
- No credential enters any bundle, the admin password included.

## Showcase

- Layers under `src/app/`: `domain`, `application` (the `book`, `contact` and `admin` facades
  and state), `infrastructure` and `ui`. A facade never imports another facade.
- Each pattern (Signal Store behind a facade, DI tokens, host directives, OnPush, virtual
  scrolling) appears only where it solves a real problem, and nowhere else.
- No component extends another component.
- Mobile first: styles start at 375 px and grow with `min-width` queries.

## Contact

- The Firebase SDK and reCAPTCHA load only inside the `contact` domain, through dynamic import.
- The Function `sendContactMessage` lives in the Nx project `ibid-website-functions`, enforces
  App Check with single-use tokens, and reads the mailbox and SMTP password from Secret Manager.
- The mailbox address never appears in code, configuration, tests or issues.

## Shared code

- Until a later epic says otherwise, the site imports no workspace lib (`ibid-ui`, `services`,
  `utils`, `testing`). Native `button`, `input`, `select` and `dialog` are allowed here for now.
