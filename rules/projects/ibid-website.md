# ibid-website

The author's public site, read like a book in four languages, and a showcase of Angular practice
that complements the CV. Static pages built from a content snapshot; the admin runs only locally.

| Field | Value |
| --- | --- |
| Path | `apps/ibid-website` |
| Nx project | `ibid-website` |
| Prefix | `website-` |
| Commit scope | `ibid-website` |
| Delivery | Static web on Firebase Hosting (site `ibid-website`, project `ibid-32cbe`) plus the contact Function |

## Mandatory steps

| Step | When |
| --- | --- |
| `plan`, `implement`, `build`, `rule-checks`, `review`, `final-verification` | `always` |
| `browser-qa`, `ux-critique` | `ui` |

The project has no lint or test target until story S2 adds them. From then on `lint`,
`author-tests`, `unit-tests` and `validate-tests` join `always`, and `accessibility` and
`performance` join `ui`. `journey` joins `ui` once story S9 adds the e2e target. Each of those
stories updates this sheet.

## Checks

| Step | Command |
| --- | --- |
| `build` | `npx nx build ibid-website` |

## Content

- The build, the tests and CI read only `src/content/content.snapshot.json`. Nothing in the
  site build talks to PocketBase.
- `npx nx run ibid-website:content` is the only writer of the snapshot. It validates before
  writing and leaves the previous snapshot untouched on any failure.
- Routes come from the snapshot at bootstrap. Never rebuild `router.config` at runtime.

## Configurations

- `site` is the published build. It holds no admin route, chunk or PocketBase client.
- `studio` is local only. It holds the admin and reads and writes the local PocketBase.
- No credential enters any bundle. The admin password is typed at login, never stored in code
  or configuration.

## Showcase

- Domains: `book`, `contact` and `content-management`, sharing only the `content` kernel.
  A domain never imports another domain.
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
