import { Router } from "express";
import { db } from "../db.js";

const router = Router();
const defects = new Set([
  "Weave Defect",
  "Shade Variation",
  "Hole/Tear",
  "Count Deviation",
  "Other",
]);
const severities = new Set(["Critical", "Major", "Minor"]);
const statuses = new Set(["Open", "Resolved"]);
const sortColumns = new Map([
  ["inspection_date", "inspection_date"],
  ["severity", "CASE severity WHEN 'Critical' THEN 3 WHEN 'Major' THEN 2 ELSE 1 END"],
  ["status", "status"],
  ["created_at", "created_at"],
]);
const findById = db.prepare("SELECT * FROM inspections WHERE id = ?");
const findByClientId = db.prepare(
  "SELECT * FROM inspections WHERE client_id = ?",
);
const insertInspection = db.prepare(`
  INSERT INTO inspections (
    client_id, inspection_date, machine_id, defect_type, severity, remarks
  ) VALUES (
    @client_id, @inspection_date, @machine_id, @defect_type, @severity, @remarks
  )
`);
const updateResolved = db.prepare(`
  UPDATE inspections
  SET status = 'Resolved', resolution_note = ?, resolved_at = datetime('now')
  WHERE id = ? AND status = 'Open'
`);

function fail(res, message, status = 400) {
  return res.status(status).json({ error: message });
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function positiveId(value) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function singleQueryValue(value) {
  return typeof value === "string" ? value : null;
}

router.post("/inspections", (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail(res, "Request body must be a JSON object.");
  }

  const clientId =
    typeof body.client_id === "string" ? body.client_id.trim().toLowerCase() : "";
  const inspectionDate =
    typeof body.inspection_date === "string" ? body.inspection_date.trim() : "";
  const machineId =
    typeof body.machine_id === "string" ? body.machine_id.trim() : "";
  const defectType =
    typeof body.defect_type === "string" ? body.defect_type.trim() : "";
  const severity = typeof body.severity === "string" ? body.severity.trim() : "";
  const remarks =
    body.remarks == null
      ? null
      : typeof body.remarks === "string"
        ? body.remarks.trim()
        : undefined;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      clientId,
    )
  ) {
    return fail(res, "client_id must be a valid UUID.");
  }
  if (!isValidDate(inspectionDate)) {
    return fail(res, "inspection_date must be a valid date in YYYY-MM-DD format.");
  }
  if (!machineId || machineId.length > 120) {
    return fail(res, "machine_id is required and must be 120 characters or fewer.");
  }
  if (!defects.has(defectType)) {
    return fail(res, "defect_type is not supported.");
  }
  if (!severities.has(severity)) {
    return fail(res, "severity is not supported.");
  }
  if (remarks === undefined || (remarks && remarks.length > 2000)) {
    return fail(res, "remarks must be 2,000 characters or fewer.");
  }

  const existing = findByClientId.get(clientId);
  if (existing) return res.status(200).json(existing);

  const result = insertInspection.run({
    client_id: clientId,
    inspection_date: inspectionDate,
    machine_id: machineId,
    defect_type: defectType,
    severity,
    remarks,
  });
  return res.status(201).json(findById.get(result.lastInsertRowid));
});

router.get("/inspections", (req, res) => {
  const { severity, status, from, to, sort, order } = req.query;
  const severityValue = singleQueryValue(severity);
  const statusValue = singleQueryValue(status);
  const fromValue = singleQueryValue(from);
  const toValue = singleQueryValue(to);
  const sortValue = sort === undefined ? "inspection_date" : singleQueryValue(sort);
  const orderValue = (order === undefined ? "desc" : singleQueryValue(order) || "").toLowerCase();

  if (severity !== undefined && (!severityValue || !severities.has(severityValue))) {
    return fail(res, "severity must be Critical, Major, or Minor.");
  }
  if (status !== undefined && (!statusValue || !statuses.has(statusValue))) {
    return fail(res, "status must be Open or Resolved.");
  }
  if (from !== undefined && (!fromValue || !isValidDate(fromValue))) {
    return fail(res, "from must be a valid date in YYYY-MM-DD format.");
  }
  if (to !== undefined && (!toValue || !isValidDate(toValue))) {
    return fail(res, "to must be a valid date in YYYY-MM-DD format.");
  }
  if (fromValue && toValue && fromValue > toValue) {
    return fail(res, "from must be on or before to.");
  }
  if (!sortValue || !sortColumns.has(sortValue)) {
    return fail(res, "sort must be inspection_date, severity, status, or created_at.");
  }
  if (!["asc", "desc"].includes(orderValue)) {
    return fail(res, "order must be asc or desc.");
  }

  const conditions = [];
  const values = [];
  if (severityValue) {
    conditions.push("severity = ?");
    values.push(severityValue);
  }
  if (statusValue) {
    conditions.push("status = ?");
    values.push(statusValue);
  }
  if (fromValue) {
    conditions.push("inspection_date >= ?");
    values.push(fromValue);
  }
  if (toValue) {
    conditions.push("inspection_date <= ?");
    values.push(toValue);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const sortColumn = sortColumns.get(sortValue);
  const direction = orderValue.toUpperCase();
  const records = db
    .prepare(
      `SELECT * FROM inspections ${where} ORDER BY ${sortColumn} ${direction}, id DESC`,
    )
    .all(...values);
  return res.json(records);
});

router.get("/inspections/:id", (req, res) => {
  const id = positiveId(req.params.id);
  if (!id) return fail(res, "Inspection id must be a positive integer.");
  const record = findById.get(id);
  if (!record) return fail(res, "Inspection not found.", 404);
  return res.json(record);
});

router.patch("/inspections/:id/resolve", (req, res) => {
  const id = positiveId(req.params.id);
  if (!id) return fail(res, "Inspection id must be a positive integer.");
  const note =
    req.body && typeof req.body.resolution_note === "string"
      ? req.body.resolution_note.trim()
      : "";
  if (!note) return fail(res, "resolution_note is required.");
  if (note.length > 2000) {
    return fail(res, "resolution_note must be 2,000 characters or fewer.");
  }

  const record = findById.get(id);
  if (!record) return fail(res, "Inspection not found.", 404);
  if (record.status === "Resolved") {
    return fail(res, "This inspection has already been resolved.", 409);
  }

  updateResolved.run(note, id);
  return res.json(findById.get(id));
});

export default router;
