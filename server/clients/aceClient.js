// Server-side client for the ACE Live API. Runs as ONE poll loop for every
// connected display (see server.js) instead of each browser tab polling
// independently - that's what caused the 429s when multiple screens were open.
// Implements the polling etiquette from API_REFERENCE.md: Retry-After-aware
// exponential backoff on 429/5xx, sequential (never parallel) range pagination.

import { API_BASE as DEFAULT_API_BASE, SITE_ID, WEC_ASSET } from "../../shared/constants.js";

// ACE_API_BASE lets you point the server at a staging copy or a local stand-in.
const API_BASE = (process.env.ACE_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, params = {}, { retries = 3 } = {}) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }

  let attempt = 0;
  let lastErr;
  while (attempt <= retries) {
    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": "ACE-Community-Display/2.0" },
      });

      if (res.status === 429 || res.status === 503) {
        lastErr = new ApiError(`HTTP ${res.status} for ${path}`, res.status);
        const retryAfter = Number(res.headers.get("Retry-After")) || 2 ** attempt;
        await sleep(retryAfter * 1000);
        attempt++;
        continue;
      }

      if (!res.ok) {
        const body = await safeJson(res);
        throw new ApiError(`HTTP ${res.status} for ${path}`, res.status, body);
      }

      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      await sleep(500 * 2 ** attempt);
      attempt++;
    }
  }
  throw lastErr || new Error(`Request failed for ${path}`);
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function getSiteLatest(fields, { resolution = "1s", limit = 1 } = {}) {
  return request(`/v1/sites/${SITE_ID}/data/site_instantaneous/latest`, {
    resolution,
    fields: fields.join(","),
    limit,
  });
}

export function getWecLatest(fields, { resolution = "1s", limit = 1 } = {}) {
  return request(`/v1/sites/${SITE_ID}/assets/${WEC_ASSET}/data/wec_instantaneous/latest`, {
    resolution,
    fields: fields.join(","),
    limit,
  });
}

export function getStatusLatest({ limit = 1 } = {}) {
  return request(`/v1/sites/${SITE_ID}/assets/${WEC_ASSET}/events/status/latest`, { limit });
}

export function getWecStdRange(fields, { resolution = "10m", start, end, pageSize = 2000 } = {}) {
  return request(`/v1/sites/${SITE_ID}/assets/${WEC_ASSET}/data/wecstd/range`, {
    resolution,
    fields: fields.join(","),
    start,
    end,
    page_size: pageSize,
  });
}

export { ApiError };
