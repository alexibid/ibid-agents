# services

Headless services shared by the products: translations, Google Drive sync, storage.

| Field | Value |
| --- | --- |
| Path | `libs/services` |
| Nx project | `services` |
| Commit scope | `services` |
| May import from | `libs/utils` |

## Mandatory steps

| Step | When |
| --- | --- |
| `plan`, `author-tests`, `implement`, `build`, `lint`, `rule-checks`, `unit-tests`, `validate-tests`, `review`, `final-verification` | `always` |

A change here also runs `build` for every app that consumes the changed service.

## Checks

| Step | Command |
| --- | --- |
| `build` | `npx nx build services` |
| `lint` | `npx nx lint services` |
| `unit-tests` | `npx nx test services` |

## Rules

- Pure headless TypeScript: no DOM and no templates. (L01)
- Never imports from an app or from a UI library. (W01, W02)
- Business rules, data transformations and the errors a user really meets have tests. (T11)
- Failures are typed errors that are thrown, never error codes.
- Drive documents are encrypted before they leave the device.
