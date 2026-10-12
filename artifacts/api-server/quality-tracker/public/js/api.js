const appBase = new URL("./", document.baseURI);
const apiBase = appBase.pathname.replace(/\/$/, "").endsWith("/api")
  ? appBase
  : new URL("./api/", appBase);

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(new URL(path, apiBase), {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    throw new ApiError("Unable to reach the server. Check your connection.", 0);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(payload?.error || "The request could not be completed.", response.status);
  }
  return payload;
}

export function getInspections(filters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  const suffix = query.size ? `?${query.toString()}` : "";
  return request(`inspections${suffix}`);
}

export function getSummary() {
  return request("summary");
}

export function createInspection(record) {
  return request("inspections", {
    method: "POST",
    body: JSON.stringify(record),
  });
}

export function resolveInspection(id, resolutionNote) {
  return request(`inspections/${encodeURIComponent(id)}/resolve`, {
    method: "PATCH",
    body: JSON.stringify({ resolution_note: resolutionNote }),
  });
}
