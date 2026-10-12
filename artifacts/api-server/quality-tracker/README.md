# Quality Inspection Tracker

A phone-first inspection log for textile shop-floor supervisors. The app uses
Node.js 20, Express, better-sqlite3, and plain HTML/CSS/JavaScript modules.

## Run in this Replit project

The tracker is served by the existing API service at `/api/`. Its database is
created at `./data/app.db` in the project root. The service's port is supplied
by the environment.

## Run with Docker

From this directory:

```sh
docker compose up --build
```

Open `http://localhost:3000`. SQLite data persists in `./data/app.db`.

## API

All responses are JSON except the static interface:

- `GET /api/health` — health status
- `GET /api/summary` — open and resolved counts by severity and overall
- `POST /api/inspections` — create an inspection; a repeated `client_id` returns
  the existing record, making offline retries safe
- `GET /api/inspections` — optional `severity`, `status`, `from`, `to`, `sort`,
  and `order` filters
- `GET /api/inspections/:id` — retrieve one record
- `PATCH /api/inspections/:id/resolve` — resolve an open record with a required
  `resolution_note`

Severity sorting ranks Critical, Major, Minor. All SQL values are parameterized,
and the sort column is selected from a fixed allowlist.

## Tests

The API tests use a temporary SQLite database and an ephemeral port:

```sh
node --test tests/api.test.mjs
```

## Offline use

The app caches its static shell and keeps new inspections in browser storage when
the server is unreachable. Pending submissions retain their UUID and sync when
connectivity returns.
