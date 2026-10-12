import { createInspection } from "./api.js";

const queueKey = "loomline.pending-inspections.v1";
const listCacheKey = "loomline.cached-inspections.v1";
const summaryCacheKey = "loomline.cached-summary.v1";

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The server remains usable even when browser storage is unavailable.
  }
}

export function getPendingInspections() {
  const pending = readJson(queueKey, []);
  return Array.isArray(pending) ? pending : [];
}

export function getCachedInspections() {
  const cached = readJson(listCacheKey, []);
  return Array.isArray(cached) ? cached : [];
}

export function getCachedSummary() {
  return readJson(summaryCacheKey, null);
}

export function cacheInspections(records) {
  writeJson(listCacheKey, records);
}

export function cacheSummary(summary) {
  writeJson(summaryCacheKey, summary);
}

export async function createOrQueueInspection(record) {
  try {
    const saved = await createInspection(record);
    return { saved, queued: false };
  } catch (error) {
    if (error.status !== 0) throw error;
    const pending = getPendingInspections();
    if (!pending.some((entry) => entry.client_id === record.client_id)) {
      pending.push(record);
      writeJson(queueKey, pending);
    }
    return { saved: null, queued: true };
  }
}

export async function syncPendingInspections() {
  const pending = getPendingInspections();
  let synced = 0;

  for (const record of pending) {
    try {
      await createInspection(record);
      const remaining = getPendingInspections().filter(
        (entry) => entry.client_id !== record.client_id,
      );
      writeJson(queueKey, remaining);
      synced += 1;
    } catch {
      break;
    }
  }
  return { synced, remaining: getPendingInspections().length };
}
