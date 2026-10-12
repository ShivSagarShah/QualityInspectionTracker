import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabase } from "./db.js";
import inspectionsRouter from "./routes/inspections.js";
import summaryRouter from "./routes/summary.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "../public");
const app = express();
const port = Number(process.env.PORT || 3000);

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
// Retain the health route used by the Replit service monitor.
app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));
app.use("/api", inspectionsRouter);
app.use("/api", summaryRouter);

app.use("/api", express.static(publicDir, { extensions: ["html"] }));
// The standalone Docker app is available at /; Replit mounts it under /api.
app.use(express.static(publicDir, { extensions: ["html"] }));
app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Route not found." });
  }
  return res.status(404).sendFile(path.join(publicDir, "index.html"));
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ error: "Request body must contain valid JSON." });
  }
  process.stderr.write(`${error?.stack || error}\n`);
  return res.status(500).json({ error: "Internal server error." });
});

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

const server = app.listen(port, "0.0.0.0", () => {
  process.stdout.write(
    `Quality Inspection Tracker listening on port ${server.address().port}\n`,
  );
});

function shutdown() {
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { app, server };
