const severityClass = {
  Critical: "critical",
  Major: "major",
  Minor: "minor",
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function formatDate(value) {
  if (!value) return "";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00`
    : value.includes("T")
      ? value
      : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function defectIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M10 3.2 17 16H3L10 3.2ZM10 7.8v4.1m0 2.2h.01");
  svg.append(path);
  return svg;
}

function addMeta(parent, text) {
  if (!text) return;
  const dot = element("span", "meta-dot");
  dot.setAttribute("aria-hidden", "true");
  parent.append(dot, element("span", "", text));
}

export function renderSummary(summary) {
  if (!summary) return;
  for (const severity of ["Critical", "Major", "Minor"]) {
    const target = document.querySelector(`[data-summary="${severity}"]`);
    if (target) target.textContent = String(summary[severity]?.open ?? 0);
  }
  const resolved = document.querySelector('[data-summary="resolved"]');
  if (resolved) resolved.textContent = String(summary.total?.resolved ?? 0);

  const open = summary.total?.open ?? 0;
  const resolvedCount = summary.total?.resolved ?? 0;
  const updated = document.getElementById("updated-label");
  if (updated) updated.textContent = `${open} open · ${resolvedCount} resolved`;
}

export function renderInspections(container, records, pending = []) {
  container.replaceChildren();
  const visibleRecords = [...pending, ...records];
  const count = document.getElementById("record-count");
  if (count) {
    count.textContent = `${visibleRecords.length} ${visibleRecords.length === 1 ? "record" : "records"}`;
  }

  if (!visibleRecords.length) {
    const state = element("div", "empty-state");
    const inner = element("div", "empty-state-inner");
    inner.append(
      element("div", "empty-mark", "✓"),
      element("strong", "", "No inspections found."),
      element("p", "", "Clear the filters or add an inspection to this log."),
    );
    state.append(inner);
    container.append(state);
    return;
  }

  visibleRecords.forEach((record, index) => {
    const pendingRecord = record.local_pending === true;
    const resolved = record.status === "Resolved";
    const severity = severityClass[record.severity] || "minor";
    const row = element(
      "article",
      `inspection-row severity-${severity}${resolved ? " is-resolved" : ""}`,
    );
    row.style.animationDelay = `${Math.min(index, 8) * 22}ms`;

    const marker = element("span", "row-marker");
    marker.append(defectIcon());
    marker.setAttribute("aria-hidden", "true");

    const main = element("div", "record-main");
    const titleLine = element("div", "record-title-line");
    titleLine.append(
      element("h3", "machine-name", record.machine_id || "Machine"),
      element("span", "record-type", record.defect_type),
    );
    const meta = element("div", "record-meta");
    addMeta(meta, formatDate(record.inspection_date));
    addMeta(meta, `ID ${record.id || "pending"}`);
    main.append(titleLine, meta);
    if (record.remarks) main.append(element("p", "record-remarks", record.remarks));
    if (record.resolution_note) {
      const note = element("p", "resolution-note");
      note.append(element("strong", "", "Resolution"));
      note.append(document.createTextNode(record.resolution_note));
      main.append(note);
    }

    const side = element("div", "record-side");
    side.append(
      element(
        "span",
        `badge${severity === "major" ? " badge-major" : ""}${severity === "minor" ? " badge-minor" : ""}`,
        pendingRecord ? "PENDING SYNC" : record.severity.toUpperCase(),
      ),
    );
    if (!pendingRecord && resolved) {
      side.append(element("span", "badge badge-resolved", "RESOLVED"));
    } else if (!pendingRecord) {
      const button = element("button", "resolve-button", "Resolve");
      button.type = "button";
      button.dataset.resolveId = String(record.id);
      button.dataset.machine = record.machine_id || "";
      button.dataset.defect = record.defect_type || "";
      side.append(button);
    }
    side.append(element("time", "record-date", formatDate(record.created_at || record.inspection_date)));
    row.append(marker, main, side);
    container.append(row);
  });
}

export function updateConnection(online, pendingCount, syncing = false) {
  const pill = document.getElementById("connection-status");
  const label = document.getElementById("connection-label");
  const note = document.getElementById("pending-note");
  if (!pill || !label) return;

  pill.classList.toggle("is-online", online && !syncing);
  pill.classList.toggle("is-offline", !online);
  pill.classList.toggle("is-syncing", syncing);
  label.textContent = syncing
    ? "Syncing"
    : online
      ? pendingCount
        ? `${pendingCount} queued`
        : "Connected"
      : "Offline";

  if (note) {
    note.textContent = pendingCount
      ? `${pendingCount} ${pendingCount === 1 ? "record is" : "records are"} waiting to sync.`
      : "Records save to this device when you're offline.";
  }
}

export function showToast(message, warning = false) {
  const region = document.getElementById("toast-region");
  const toast = element("div", `toast${warning ? " is-warning" : ""}`, message);
  region.append(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

export function setButtonBusy(button, busy, busyLabel) {
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  if (busyLabel) {
    const label = button.querySelector("span");
    if (label) {
      if (!button.dataset.idleLabel) button.dataset.idleLabel = label.textContent;
      label.textContent = busy ? busyLabel : button.dataset.idleLabel;
    }
  }
}
