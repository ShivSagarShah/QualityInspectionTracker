import { Router } from "express";
import { db } from "../db.js";

const router = Router();
const emptyCounts = () => ({ open: 0, resolved: 0 });

router.get("/summary", (_req, res) => {
  const summary = {
    Critical: emptyCounts(),
    Major: emptyCounts(),
    Minor: emptyCounts(),
    total: emptyCounts(),
  };

  const rows = db
    .prepare(
      `SELECT severity, status, COUNT(*) AS count
       FROM inspections
       GROUP BY severity, status`,
    )
    .all();

  for (const row of rows) {
    const state = row.status.toLowerCase();
    summary[row.severity][state] = row.count;
    summary.total[state] += row.count;
  }

  return res.json(summary);
});

export default router;
