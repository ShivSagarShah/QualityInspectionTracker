# Quality Inspection Tracker scaffold

Node.js 20, Express, and better-sqlite3 scaffold with a SQLite database and a
health-check endpoint.

## Install and run

From this directory:

```sh
npm install
npm start
```

The server listens on `PORT`, or port 3000 when `PORT` is unset. Check it with:

```sh
curl http://localhost:3000/api/health
```

Run in watch mode with `npm run dev`, and run the built-in Node.js tests with
`npm test`.

SQLite creates `data/app.db` on first start. Static files placed in `public/`
are served under `/public`.

## Docker

```sh
docker compose up --build
```

The service is available at `http://localhost:3000`; SQLite data persists in
`data/app.db`.
