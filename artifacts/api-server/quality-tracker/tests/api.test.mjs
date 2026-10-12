import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "loomline-test-"));
process.env.DATABASE_PATH = path.join(testDirectory, "test.db");
process.env.PORT = "0";

const [{ app, server }, { closeDatabase }] = await Promise.all([
  import("../server/index.js"),
  import("../server/db.js"),
]);

if (!server.listening) await once(server, "listening");
const baseUrl = `http://127.0.0.1:${server.address().port}`;

async function json(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  return { response, body: await response.json() };
}

function inspection(overrides = {}) {
  return {
    client_id: crypto.randomUUID(),
    inspection_date: "2026-10-12",
    machine_id: "Loom 04",
    defect_type: "Weave Defect",
    severity: "Major",
    remarks: "Uneven tension on the edge.",
    ...overrides,
  };
}

before(() => {
  assert.equal(typeof app, "function");
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  closeDatabase();
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

test("inspection tracker API and static phone UI", async () => {
  const health = await json("/api/health");
  assert.equal(health.response.status, 200);
  assert.deepEqual(health.body, { status: "ok" });

  const page = await fetch(`${baseUrl}/api/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Quality log/);
  const proxiedScript = await fetch(`${baseUrl}/api/js/api.js`);
  assert.equal(proxiedScript.status, 200);
  assert.match(proxiedScript.headers.get("content-type"), /javascript/);
  const dockerScript = await fetch(`${baseUrl}/js/api.js`);
  assert.equal(dockerScript.status, 200);
  assert.match(dockerScript.headers.get("content-type"), /javascript/);

  const invalid = await json("/api/inspections", {
    method: "POST",
    body: JSON.stringify(inspection({ severity: "Urgent" })),
  });
  assert.equal(invalid.response.status, 400);
  assert.equal(typeof invalid.body.error, "string");

  const criticalInput = inspection({
    severity: "Critical",
    defect_type: "Hole/Tear",
    machine_id: "Loom 01",
    inspection_date: "2026-10-12",
  });
  const created = await json("/api/inspections", {
    method: "POST",
    body: JSON.stringify(criticalInput),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.status, "Open");
  assert.equal(created.body.client_id, criticalInput.client_id);

  const repeated = await json("/api/inspections", {
    method: "POST",
    body: JSON.stringify({
      ...criticalInput,
      client_id: criticalInput.client_id.toUpperCase(),
    }),
  });
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.body.id, created.body.id);

  const major = await json("/api/inspections", {
    method: "POST",
    body: JSON.stringify(inspection({ severity: "Major" })),
  });
  const minor = await json("/api/inspections", {
    method: "POST",
    body: JSON.stringify(inspection({ severity: "Minor" })),
  });
  assert.equal(major.response.status, 201);
  assert.equal(minor.response.status, 201);

  const sorted = await json("/api/inspections?sort=severity&order=desc");
  assert.deepEqual(sorted.body.map((item) => item.severity), [
    "Critical",
    "Major",
    "Minor",
  ]);
  const unsafeSort = await json("/api/inspections?sort=inspection_date%20DESC");
  assert.equal(unsafeSort.response.status, 400);
  const invalidDateFilter = await json("/api/inspections?from=2026-02-30");
  assert.equal(invalidDateFilter.response.status, 400);

  const filtered = await json("/api/inspections?status=Open&severity=Critical");
  assert.equal(filtered.body.length, 1);
  assert.equal(filtered.body[0].id, created.body.id);

  const detail = await json(`/api/inspections/${created.body.id}`);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.machine_id, "Loom 01");

  const summary = await json("/api/summary");
  assert.deepEqual(summary.body, {
    Critical: { open: 1, resolved: 0 },
    Major: { open: 1, resolved: 0 },
    Minor: { open: 1, resolved: 0 },
    total: { open: 3, resolved: 0 },
  });

  const missingNote = await json(`/api/inspections/${created.body.id}/resolve`, {
    method: "PATCH",
    body: JSON.stringify({ resolution_note: "  " }),
  });
  assert.equal(missingNote.response.status, 400);

  const resolved = await json(`/api/inspections/${created.body.id}/resolve`, {
    method: "PATCH",
    body: JSON.stringify({ resolution_note: "Re-tensioned and rechecked." }),
  });
  assert.equal(resolved.response.status, 200);
  assert.equal(resolved.body.status, "Resolved");
  assert.equal(resolved.body.resolution_note, "Re-tensioned and rechecked.");
  assert.ok(resolved.body.resolved_at);

  const conflict = await json(`/api/inspections/${created.body.id}/resolve`, {
    method: "PATCH",
    body: JSON.stringify({ resolution_note: "Trying again." }),
  });
  assert.equal(conflict.response.status, 409);

  const absent = await json("/api/inspections/9999");
  assert.equal(absent.response.status, 404);
});
