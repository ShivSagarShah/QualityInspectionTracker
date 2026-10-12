import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { after, test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabase, db } from "../server/db.js";

const appDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

after(() => closeDatabase());

test("SQLite opens with the expected schema, indexes, and pragmas", () => {
  assert.equal(db.pragma("journal_mode", { simple: true }), "wal");
  assert.equal(db.pragma("foreign_keys", { simple: true }), 1);

  const columns = db.pragma("table_info(inspections)").map(({ name }) => name);
  assert.deepEqual(columns, [
    "id",
    "client_id",
    "inspection_date",
    "machine_id",
    "defect_type",
    "severity",
    "remarks",
    "status",
    "resolution_note",
    "resolved_at",
    "source",
    "created_at",
  ]);

  const indexes = db
    .pragma("index_list(inspections)")
    .map(({ name }) => name);
  for (const index of [
    "idx_inspections_severity",
    "idx_inspections_status",
    "idx_inspections_inspection_date",
  ]) {
    assert.ok(indexes.includes(index), `missing index ${index}`);
  }
});

test("GET /api/health returns JSON status", async () => {
  const child = spawn(process.execPath, ["server/index.js"], {
    cwd: appDirectory,
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  let errors = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    errors += chunk;
  });

  let didStart = false;
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Server did not start. stderr: ${errors}`));
    }, 10_000);

    child.stdout.on("data", () => {
      const match = output.match(/listening on port (\d+)/i);
      if (match) {
        didStart = true;
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    });

    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (!didStart) {
        clearTimeout(timeout);
        reject(
          new Error(
            `Server exited before starting (code ${code}, signal ${signal}). ${errors}`,
          ),
        );
      }
    });
  });

  try {
    const origin = await ready;
    const response = await fetch(`${origin}/api/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(await response.json(), { status: "ok" });
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await Promise.race([exited, delay(3_000)]);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }
  }
});
