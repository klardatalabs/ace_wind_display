// Server-side client for the ACE Live API. Runs as ONE poll loop for every
// connected display (see server.js) instead of each browser tab polling
// independently - that's what caused the 429s when multiple screens were open.
// Implements the polling etiquette from API_REFERENCE.md: Retry-After-aware
// exponential backoff on 429/5xx, sequential (never parallel) range pagination.

import { API_BASE as DEFAULT_API_BASE, SITE_ID, WEC_ASSET } from "../../shared/constants.js";
import { normaliseTimestamp } from '../history/telemetry.js';

// ACE_API_BASE lets you point the server at a staging copy or a local stand-in.
const API_BASE = (process.env.ACE_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
const siteId = process.env.HISTORY_SITE || SITE_ID;
const assetId = process.env.HISTORY_ASSET || WEC_ASSET;

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
        signal: AbortSignal.timeout(Number(process.env.ACE_TIMEOUT_MS) || 15000),
        headers: { Accept: "application/json", "User-Agent": "ACE-Community-Display/2.0" },
      });

      if (res.status === 429 || res.status === 503) {
        lastErr = new ApiError(`HTTP ${res.status} for ${path}`, res.status);
        if (attempt === retries) break;
        const header = res.headers.get('Retry-After');
        const retryAfter = header === null ? 2 ** attempt : Number.isFinite(Number(header)) ? Number(header) : Math.max(0,(Date.parse(header)-Date.now())/1000);
        await sleep(Math.max(0,Number.isFinite(retryAfter) ? retryAfter : 2 ** attempt) * 1000);
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
      if (err.status >= 400 && err.status < 500 && err.status !== 429) break;
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
  return request(`/v1/sites/${siteId}/data/site_instantaneous/latest`, {
    resolution,
    fields: fields.join(","),
    limit,
  });
}

export function getWecLatest(fields, { resolution = "1s", limit = 1 } = {}) {
  return request(`/v1/sites/${siteId}/assets/${assetId}/data/wec_instantaneous/latest`, {
    resolution,
    fields: fields.join(","),
    limit,
  });
}

export function getStatusLatest({ limit = 1 } = {}) {
  return request(`/v1/sites/${siteId}/assets/${assetId}/events/status/latest`, { limit });
}
export function getApiStatus() { return request('/v1/status'); }

export function getWecStdRange(fields, { resolution = "10m", start, end, pageSize = 2000, cursor } = {}) {
  return request(`/v1/sites/${siteId}/assets/${assetId}/data/wecstd/range`, {
    resolution,
    fields: fields.join(","),
    start,
    end,
    page_size: pageSize,
    cursor,
  });
}

export async function* getWecStdPages(fields, options = {}) {
  const seen = new Set(); let cursor; let previous = -Infinity;
  do {
    const data = await getWecStdRange(fields,{...options,cursor});
    if (!Array.isArray(data.timestamps) || !data.series) throw new Error('Invalid range response');
    if ((data.asset && data.asset!==assetId) || (data.site && data.site!==siteId) || (data.resolution && data.resolution!==(options.resolution || '10m'))) throw new Error('Unexpected range identity or resolution');
    for (const field of fields) if (data.series[field] !== undefined && (!Array.isArray(data.series[field]) || data.series[field].length !== data.timestamps.length)) throw new Error('Misaligned range series');
    for (const raw of data.timestamps) {
      const instant = Date.parse(normaliseTimestamp(raw));
      if (instant <= previous) throw new Error('Range timestamps did not advance');
      previous = instant;
    }
    const next = data.page?.next_cursor;
    if (data.page?.has_more && (!next || !data.timestamps.length)) throw new Error('Incomplete range page');
    if (next && seen.has(next)) throw new Error('Repeated range cursor');
    if (next) seen.add(next);
    yield data;
    cursor = next;
  } while (cursor);
}

export async function getWecStdRangeAll(fields, options = {}) {
  const out = {timestamps:[],series:Object.fromEntries(fields.map(f=>[f,[]]))};
  for await (const page of getWecStdPages(fields,options)) {
    out.timestamps.push(...page.timestamps);
    for (const field of fields) out.series[field].push(...(page.series[field] ?? page.timestamps.map(()=>null)));
  }
  return out;
}

export { ApiError };
