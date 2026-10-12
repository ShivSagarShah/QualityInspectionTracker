import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDirectory = path.join(process.cwd(), "data");
fs.mkdirSync(dataDirectory, { recursive: true });

export const db = new Database(path.join(dataDirectory, "app.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT UNIQUE,
    inspection_date TEXT NOT NULL,
    machine_id TEXT NOT NULL,
    defect_type TEXT NOT NULL CHECK (defect_type IN (
      'Weave Defect', 'Shade Variation', 'Hole/Tear', 'Count Deviation', 'Other'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('Critical', 'Major', 'Minor')),
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Resolved')),
    resolution_note TEXT,
    resolved_at TEXT,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'sap')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_inspections_severity
    ON inspections (severity);
  CREATE INDEX IF NOT EXISTS idx_inspections_status
    ON inspections (status);
  CREATE INDEX IF NOT EXISTS idx_inspections_inspection_date
    ON inspections (inspection_date);
`);

export function closeDatabase() {
  if (db.open) db.close();
}

export default db;
