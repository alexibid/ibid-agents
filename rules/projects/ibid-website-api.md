# ibid-website-api

The content API of ibid-website: NestJS over PostgreSQL in Docker, local only. The admin and
the content export talk to it; nothing else ever reaches the database.

| Field | Value |
| --- | --- |
| Path | `apps/ibid-website/api` |
| Nx project | `ibid-website-api` |
| Commit scope | `ibid-website` |
| Runtime | `apps/ibid-website/compose.yaml`: `postgres:17-alpine` on `127.0.0.1:54330`, the API on `127.0.0.1:4510` |
| Delivery | None. Runs only on the Mac; never published |

## Mandatory steps

| Step | When |
| --- | --- |
| `plan`, `author-tests`, `implement`, `build`, `lint`, `rule-checks`, `unit-tests`, `validate-tests`, `review`, `final-verification` | `always` |

## Checks

| Step | Command |
| --- | --- |
| `build` | `npx nx build ibid-website-api` |
| `lint` | `npx nx lint ibid-website-api` |
| `unit-tests` | `npx nx test ibid-website-api` |

## Rules

- NestJS 11, drizzle-orm and pg, the same versions as `papikapi-api`. No other framework.
- Every route lives under `/api/v1`. Reads are open on localhost; every write needs the session.
- SQL only through drizzle with parameters. Never build a query from strings.
- Ports bind to `127.0.0.1` only. Postgres is never exposed, not even later online.
- Secrets (`ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, Postgres credentials) live only in the
  gitignored `api/.env`. `.env.example` holds placeholders.
- Every test mocks the database and the file system. No test talks to Postgres, a running API,
  PocketBase or local data.
- Failures are typed errors that are thrown, never error codes.
