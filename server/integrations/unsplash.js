// Photo search on Unsplash, for pictures shown with chat answers. Searches run here so the
// access key never reaches a browser. Results are cached (demo keys allow 50 requests an
// hour), every photo carries photographer attribution with UTM tags, and the "download"
// ping Unsplash asks for is sent the first time a photo is shown.

import { config } from "../config/index.js";
import { cached } from "../infra/cache.js";
import { redis, redisHealthy } from "../infra/redis.js";

const UTM = "utm_source=weston_wind&utm_medium=referral";
const withUtm = (url) => (url ? `${url}${url.includes("?") ? "&" : "?"}${UTM}` : url);
const headers = () => ({ Authorization: `Client-ID ${config.unsplash.accessKey}`, "Accept-Version": "v1" });

export const photosEnabled = () => Boolean(config.unsplash.accessKey);

export function normalisePhoto(p) {
  return {
    id: p.id,
    alt: p.alt_description || p.description || "Photo from Unsplash",
    color: p.color || "#cbd5df",
    width: p.width,
    height: p.height,
    thumb: p.urls?.small || p.urls?.thumb,
    regular: p.urls?.regular,
    page: withUtm(p.links?.html),
    author: p.user?.name || "Unsplash photographer",
    authorUrl: withUtm(p.user?.links?.html),
    downloadLocation: p.links?.download_location,
  };
}

/** Up to `count` landscape photos for `query` (cached for six hours). */
export async function searchPhotos(query, { count = 4, orientation = "landscape" } = {}) {
  const q = String(query).replace(/\s+/g, " ").trim().slice(0, 80);
  if (!q || !photosEnabled()) return [];
  const n = Math.min(8, Math.max(1, Math.floor(count)));
  return cached(`unsplash:${q.toLowerCase()}:${n}:${orientation}`, { freshSec: 6 * 3600, staleSec: 18 * 3600 }, async () => {
    const url = new URL(`${config.unsplash.baseUrl}/search/photos`);
    url.search = new URLSearchParams({ query: q, per_page: String(n), orientation, content_filter: "high" }).toString();
    const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(config.unsplash.timeoutMs) });
    if (!res.ok) throw new Error(`Unsplash responded ${res.status}`);
    const data = await res.json();
    return (data.results || []).map(normalisePhoto).filter((p) => p.thumb && p.regular && p.width > 0 && p.height > 0 && p.authorUrl?.startsWith("https://"));
  });
}

/** Tells Unsplash a photo was shown, once per photo across all instances. Never throws. */
export async function trackPhotosShown(photos) {
  for (const p of photos) {
    if (!p.downloadLocation) continue;
    if (redisHealthy()) {
      const first = await redis.set(`unsplash-tracked:${p.id}`, "1", "EX", 30 * 86_400, "NX").catch(() => "OK");
      if (first !== "OK") continue;
    }
    fetch(p.downloadLocation, { headers: headers(), signal: AbortSignal.timeout(config.unsplash.timeoutMs) }).catch(() => {});
  }
}
