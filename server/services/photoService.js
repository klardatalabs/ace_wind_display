// Photos from Unsplash, for the chat (a strip of pictures above Ace's answer) and the photo
// banner at the top of the chat page. Searches are made here, on the server, so the access
// key never reaches a browser. Follows Unsplash's API guidelines: images are hotlinked from
// their CDN, every photo carries photographer + Unsplash attribution links (with utm tags),
// and a "download" ping is sent the first time a photo is shown.
//
// Demo-tier keys allow 50 requests an hour, so results are cached for six hours.

import { config } from "../config/env.js";

const UTM = "utm_source=weston_wind&utm_medium=referral";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 150;
const cache = new Map();
const pinged = new Set();

export const isPhotoSearchEnabled = () => Boolean(config.unsplash.accessKey);

const headers = () => ({ Authorization: `Client-ID ${config.unsplash.accessKey}`, "Accept-Version": "v1" });
const withUtm = (url) => (url ? `${url}${url.includes("?") ? "&" : "?"}${UTM}` : url);

/** Unsplash search result -> the small shape the frontend uses. */
export function normalisePhoto(p) {
  return {
    id: p.id,
    alt: p.alt_description || p.description || "Photo from Unsplash",
    color: p.color || "#cbd5df",
    width: p.width,
    height: p.height,
    // images.unsplash.com supports on-the-fly sizing; ask for what each place needs
    thumb: p.urls?.small || p.urls?.thumb,
    regular: p.urls?.regular,
    page: withUtm(p.links?.html),
    author: p.user?.name || "Unsplash photographer",
    authorUrl: withUtm(p.user?.links?.html),
    unsplashUrl: `https://unsplash.com/?${UTM}`,
    downloadLocation: p.links?.download_location,
  };
}

/**
 * @param {string} query
 * @param {{ count?: number, orientation?: "landscape"|"portrait"|"squarish" }} [opts]
 * @returns {Promise<ReturnType<typeof normalisePhoto>[]>}
 */
export async function searchPhotos(query, { count = 4, orientation = "landscape" } = {}) {
  if (!isPhotoSearchEnabled()) return [];
  const q = String(query).replace(/\s+/g, " ").trim().slice(0, 80);
  if (!q) return [];
  const n = Math.min(8, Math.max(1, Math.floor(count)));
  const key = `${q.toLowerCase()}|${n}|${orientation}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.photos;

  const url = new URL(`${config.unsplash.baseUrl}/search/photos`);
  url.search = new URLSearchParams({ query: q, per_page: String(n), orientation, content_filter: "high" }).toString();
  const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(config.unsplash.timeoutMs) });
  if (!res.ok) throw new Error(`Unsplash responded ${res.status}`);
  const data = await res.json();
  const photos = (data.results || []).map(normalisePhoto).filter((p) => p.thumb && p.regular);
  if (photos.length) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), photos });
  }
  return photos;
}

/** Tells Unsplash a photo was used (once per photo), as their guidelines ask. Never throws. */
export function trackDownload(photos) {
  for (const p of photos) {
    if (!p.downloadLocation || pinged.has(p.id)) continue;
    pinged.add(p.id);
    if (pinged.size > 2000) pinged.clear();
    fetch(p.downloadLocation, { headers: headers(), signal: AbortSignal.timeout(config.unsplash.timeoutMs) }).catch(() => {});
  }
}
