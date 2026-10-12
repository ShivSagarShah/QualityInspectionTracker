import { ApiError, getInspections, getSummary, resolveInspection } from "./api.js";
import {
  cacheInspections,
  cacheSummary,
  createOrQueueInspection,
  getCachedInspections,
  getCachedSummary,
  getPendingInspections,
  syncPendingInspections,
} from "./offline.js";
import {
  renderInspections,
  renderSummary,
  setButtonBusy,
  showToast,
  updateConnection,
} from "./ui.js";

const inspectionList = document.getElementById("inspection-list");
const inspectionDialog = document.getElementById("inspection-dialog");
const resolveDialog = document.getElementById("resolve-dialog");
let selectedStatus = "";
let records = getCachedInspections();
let summary = getCachedSummary();

function filtersFromForm() {
  const form = document.getElementById("filter-form");
  const data = new FormData(form);
  const [sort, order] = String(data.get("sort") || "inspection_date:desc").split(":");
  return {
    ...(selectedStatus ? { status: selectedStatus } : {}),
    ...(data.get("severity") ? { severity: data.get("severity") } : {}),
    ...(data.get("from") ? { from: data.get("from") } : {}),
    ...(data.get("to") ? { to: data.get("to") } : {}),
    sort,
    order,
  };
}

function pendingForDisplay() {
  const filters = filtersFromForm();
  return getPendingInspections()
    .filter((record) => !filters.status || filters.status === "Open")
    .filter((record) => !filters.severity || record.severity === filters.severity)
    .filter((record) => !filters.from || record.inspection_date >= filters.from)
    .filter((record) => !filters.to || record.inspection_date <= filters.to)
    .map((record) => ({
      ...record,
      id: "",
      status: "Open",
      local_pending: true,
      created_at: record.created_at || new Date().toISOString(),
    }));
}

function render() {
  renderSummary(summary);
  renderInspections(inspectionList, records, pendingForDisplay());
  updateConnection(navigator.onLine, getPendingInspections().length);
}

async function refresh({ showError = false } = {}) {
  inspectionList.setAttribute("aria-busy", "true");
  if (!records.length) {
    inspectionList.replaceChildren();
    const loading = document.createElement("div");
    loading.className = "loading-row";
    const loader = document.createElement("span");
    loader.className = "loader";
    loader.setAttribute("aria-hidden", "true");
    loading.append(loader, document.createTextNode("Loading inspections"));
    inspectionList.append(loading);
  }

  const results = await Promise.allSettled([
    getInspections(filtersFromForm()),
    getSummary(),
  ]);
  const [listResult, summaryResult] = results;
  let failed = false;
  let requestError = null;

  if (listResult.status === "fulfilled") {
    records = listResult.value;
    cacheInspections(records);
  } else {
    failed = true;
    requestError = listResult.reason;
    if (!records.length) records = getCachedInspections();
  }
  if (summaryResult.status === "fulfilled") {
    summary = summaryResult.value;
    cacheSummary(summary);
  } else {
    failed = true;
    requestError ||= summaryResult.reason;
    if (!summary) summary = getCachedSummary();
  }

  inspectionList.setAttribute("aria-busy", "false");
  render();
  if (failed && showError && !navigator.onLine) {
    showToast(
      records.length
        ? "Offline — showing the last saved inspection list."
        : "Offline — saved inspections will appear when you reconnect.",
      true,
    );
  } else if (failed && showError) {
    showToast(requestError?.message || "Couldn't refresh the latest inspection data.", true);
  }
}

document.getElementById("open-inspection").addEventListener("click", () => {
  const form = document.getElementById("inspection-form");
  form.reset();
  form.elements.inspection_date.value = new Date().toISOString().slice(0, 10);
  inspectionDialog.showModal();
  form.elements.machine_id.focus();
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById(button.dataset.close).close();
  });
});

for (const dialog of [inspectionDialog, resolveDialog]) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

document.getElementById("inspection-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById("save-inspection");
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const record = {
    client_id: crypto.randomUUID(),
    inspection_date: data.get("inspection_date"),
    machine_id: String(data.get("machine_id")).trim(),
    defect_type: data.get("defect_type"),
    severity: data.get("severity"),
    remarks: String(data.get("remarks") || "").trim() || null,
  };

  setButtonBusy(button, true, "Saving…");
  try {
    const result = await createOrQueueInspection(record);
    inspectionDialog.close();
    form.reset();
    const filterForm = document.getElementById("filter-form");
    filterForm.elements.severity.value = "";
    filterForm.elements.from.value = "";
    filterForm.elements.to.value = "";
    filterForm.elements.sort.value = "inspection_date:desc";
    selectedStatus = "";
    document.querySelectorAll(".status-tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.status === "");
    });
    await refresh();
    showToast(result.queued ? "Saved on this device. It will sync when you're online." : "Inspection saved.");
  } catch (error) {
    showToast(error.message || "Unable to save this inspection.", true);
  } finally {
    setButtonBusy(button, false);
  }
});

inspectionList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-resolve-id]");
  if (!button) return;
  const form = document.getElementById("resolve-form");
  form.reset();
  form.elements.inspection_id.value = button.dataset.resolveId;
  document.getElementById("resolve-context").textContent =
    `${button.dataset.machine} · ${button.dataset.defect}`;
  resolveDialog.showModal();
  form.elements.resolution_note.focus();
});

document.getElementById("resolve-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const button = document.getElementById("save-resolution");
  const id = form.elements.inspection_id.value;
  const note = String(form.elements.resolution_note.value).trim();
  setButtonBusy(button, true, "Saving…");
  try {
    await resolveInspection(id, note);
    resolveDialog.close();
    await refresh();
    showToast("Issue marked resolved.");
  } catch (error) {
    showToast(error.message || "Unable to resolve this issue.", true);
  } finally {
    setButtonBusy(button, false);
  }
});

document.querySelectorAll(".status-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    selectedStatus = tab.dataset.status || "";
    document.querySelectorAll(".status-tab").forEach((other) => {
      other.classList.toggle("is-active", other === tab);
    });
    void refresh();
  });
});

document.getElementById("filter-form").addEventListener("change", () => void refresh());
document.getElementById("filter-form").addEventListener("reset", () => {
  selectedStatus = "";
  document.querySelectorAll(".status-tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.status === "");
  });
  window.setTimeout(() => void refresh({ showError: true }), 0);
});

window.addEventListener("online", async () => {
  updateConnection(true, getPendingInspections().length, true);
  const result = await syncPendingInspections();
  render();
  await refresh();
  if (result.synced) {
    showToast(`${result.synced} ${result.synced === 1 ? "inspection" : "inspections"} synced.`);
  }
});

window.addEventListener("offline", () => {
  updateConnection(false, getPendingInspections().length);
});

renderSummary(summary);
renderInspections(inspectionList, records, pendingForDisplay());
updateConnection(navigator.onLine, getPendingInspections().length);
void refresh({ showError: true });

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // The app still works online if service-worker registration is unavailable.
  });
}
