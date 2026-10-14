// HTTP for the ACE Live API, following its polling etiquette: honour Retry-After on 429 and
// 503, back off exponentially on server errors and timeouts, never retry other 4xx errors.

import { config } from "../../config/index.js";

export class AceError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Seconds to wait from a Retry-After header (delta-seconds or an HTTP date). */
export function retryAfterSeconds(header, fallback) {
  if (header == null) return fallback;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const at = Date.parse(header);
  return Number.isFinite(at) ? Math.max(0, (at - Date.now()) / 1000) : fallback;
}

/** GET `path` with query `params`; resolves to the parsed JSON body. */
export async function aceGet(path, params = {}, { retries = 2 } = {}) {
  const url = new URL(config.ace.baseUrl + path);
  for (const [key, value] of Object.entries(params)) if (value != null) url.searchParams.set(key, String(value));

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "WestonWind/3 (+community display)" },
        signal: AbortSignal.timeout(config.ace.timeoutMs),
      });
      if (res.status === 429 || res.status === 503) {
        lastError = new AceError(`ACE ${res.status} for ${path}`, res.status);
        if (attempt < retries) await sleep(retryAfterSeconds(res.headers.get("Retry-After"), 2 ** attempt) * 1000);
        continue;
      }
      if (!res.ok) {
        lastError = new AceError(`ACE ${res.status} for ${path}`, res.status);
        if (res.status < 500) break; // a client error won't fix itself
      } else {
        return await res.json();
      }
    } catch (err) {
      lastError = err;
    }
    if (attempt < retries) await sleep(500 * 2 ** attempt);
  }
  throw lastError ?? new AceError(`ACE request failed for ${path}`);
}
