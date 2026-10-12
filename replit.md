# Quality Inspection Tracker

A phone-first, offline-capable inspection log for textile shop-floor supervisors.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the app in the Replit preview at `/api/`
- `pnpm --dir artifacts/api-server/quality-tracker test` — run the API tests against a temporary SQLite database
- `pnpm --filter @workspace/api-server run typecheck` — typecheck the workspace API scaffold
- `docker compose up --build` from `artifacts/api-server/quality-tracker` — run the standalone app on port 3000
- The app database defaults to `./data/app.db`; set `DATABASE_PATH` to change it

## Stack

- Runtime target: Node.js 20
- Backend: Express and better-sqlite3
- Frontend: static HTML, CSS, and vanilla JavaScript ES modules; no build step
- Local container: one Dockerfile, one Docker Compose service, one process, port 3000
- Replit serves the tracker and its API through the existing `/api` service route

## Where Things Live

- `artifacts/api-server/quality-tracker/server/` — SQLite setup and Express routes
- `artifacts/api-server/quality-tracker/public/` — mobile interface, browser modules, and offline service worker
- `artifacts/api-server/quality-tracker/tests/` — API contract tests
- `artifacts/api-server/quality-tracker/Dockerfile` and `docker-compose.yml` — standalone Node 20 container

## Product

- Create and browse fabric inspection records, filter by severity, status, and date, and sort the results
- Track open and resolved counts by severity
- Resolve an issue with a required resolution note
- Queue new inspections offline and sync them idempotently using client UUIDs

## Product Rules

- Keep the specified Node.js 20, Express, better-sqlite3, and vanilla frontend stack
- Use parameterized SQL for values and a fixed allowlist for sort columns
- Validate request values on the server and return JSON errors
- Keep the mobile experience usable at 390px width
