import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db, { closeDatabase } from "./db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "../public");
const app = express();
const port = Number(process.env.PORT || 3000);

app.disable("x-powered-by");
app.use(express.json());
app.use("/public", express.static(publicDir));
app.locals.db = db;

// Mount additional route modules here as the API grows:
// app.use("/api/inspections", inspectionsRouter);
// app.use("/api/summary", summaryRouter);
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const server = app.listen(port, "0.0.0.0", () => {
  process.stdout.write(
    `Quality Inspection Tracker scaffold listening on port ${server.address().port}\n`,
  );
});

function shutdown() {
  server.close(() => {
    closeDatabase();
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { app, server };
