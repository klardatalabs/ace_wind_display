// Every server endpoint the frontend uses, in one place. Pages import from here rather
// than calling fetch directly, so the Developers page can list exactly what exists.

async function request(path, { method = "GET", body, token, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty or non-JSON body
  }
  if (!res.ok) {
    const err = new Error(data?.error || `${res.status} ${res.statusText}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // Live turbine
  state: () => request("/api/state"),
  config: () => request("/api/config"),

  // History (TimescaleDB when available, SQLite / ACE API otherwise)
  history: (hours = 24) => request(`/api/history?hours=${hours}`),
  compare: (params = {}) => request(`/api/history/compare?${new URLSearchParams(params)}`),
  records: () => request("/api/history/records"),
  powerCurve: () => request("/api/history/power-curve"),
  daily: (limit = 30) => request(`/api/history/daily?limit=${limit}`),
  seasons: (signal) => request("/api/history/seasons", { signal }),
  news: (signal) => request("/api/news", { signal }),
  researchLibrary: (signal) => request("/api/research/library", { signal }),

  // Open data
  datasets: () => request("/api/datasets"),

  // Ask Ace (anonymous, per-tab sessions; replies stream via ./sse.js)
  chatSession: (screen) => request("/api/chat/session", { method: "POST", body: { screen } }),
  chatHistory: (token) => request("/api/chat/history", { token }),
  chatReset: (token) => request("/api/chat/session", { method: "DELETE", token }),

  // Where the turbine stands right now: weather at the site + any demo override
  environment: () => request("/api/environment"),
  // The South West grid right now: generation mix and carbon intensity (National Grid ESO)
  grid: () => request("/api/grid"),

  // Photographs from Unsplash (searched on the server so the key stays secret)
  photos: (query, count = 5) => request(`/api/photos?q=${encodeURIComponent(query)}&count=${count}`),

  // Phone -> hoarding remote control
  screens: () => request("/api/screens"),
  screenCommand: (token, action, value) => request("/api/screens/command", { method: "POST", token, body: value === undefined ? { action } : { action, value } }),

};

/** Endpoint catalogue shown on the Developers page. */
export const ENDPOINTS = [
  { group: "Live", method: "GET", path: "/api/state", about: "Latest turbine snapshot: power, wind, rotor rpm, nacelle bearing, today's energy, status flags.", tryIt: true },
  { group: "Live", method: "WS", path: "/ws", about: "Pushes { type: 'state' } and { type: 'environment' } on every change. Big screens send { type: 'screen.subscribe', screen } to also receive { type: 'screen.command', action, value }." },
  { group: "Live", method: "GET", path: "/api/config", about: "Public origin used for the QR codes.", tryIt: true },
  { group: "History", method: "GET", path: "/api/history?hours=24", about: "Wind and power series for the last N hours (10-minute resolution up to 48 h, daily beyond).", tryIt: true },
  { group: "History", method: "GET", path: "/api/history/daily?limit=30", about: "Daily energy, wind and availability rollups.", tryIt: true },
  { group: "History", method: "GET", path: "/api/history/compare", about: "Today vs yesterday, this month vs last (or custom ranges with mode, start1, end1, start2, end2).", tryIt: true },
  { group: "History", method: "GET", path: "/api/history/records", about: "All-time records: best day, peak gust, cumulative energy.", tryIt: true },
  { group: "History", method: "GET", path: "/api/history/power-curve", about: "Measured power curve binned by wind speed, with the theoretical curve alongside.", tryIt: true },
  { group: "History", method: "GET", path: "/api/history/seasons", about: "Four complete UK meteorological seasons from stored turbine measurements, with coverage and nacelle-direction proxy.", tryIt: true },
  { group: "News", method: "GET", path: "/api/news", about: "Automatically selected clean-energy headlines with publisher, date, link and freshness.", tryIt: true },
  { group: "Ask Ace", method: "GET", path: "/api/research/library", about: "Public research shelf, with links and whether each source is loaded for chat answers.", tryIt: true },
  { group: "History", method: "GET", path: "/api/history/health", about: "Stored coverage, freshness and maintenance outcomes.", tryIt: true },
  { group: "History", method: "GET", path: "/api/history/export?format=csv", about: "Stream the combined maintained history as CSV, with units, quality and provenance." },
  { group: "Open data", method: "GET", path: "/api/datasets", about: "The open datasets (CC BY 4.0), the dates each covers, and the Zenodo archive.", tryIt: true },
  { group: "Open data", method: "GET", path: "/api/datasets/scada_10m.csv?from=2026-10-01&to=2026-10-07", about: "Instant CSV download for a dataset and UK date range (inclusive); no sign-up." },
  { group: "Ask Ace", method: "POST", path: "/api/chat/session", about: "Mint an anonymous, signed session token for one browser tab ({ screen })." },
  { group: "Ask Ace", method: "POST", path: "/api/chat/stream", about: "Send { message }; the reply streams back as Server-Sent Events: token, status, sources, action, done, error." },
  { group: "Ask Ace", method: "GET", path: "/api/chat/history", about: "This session's own transcript (Bearer token), so a reload keeps the conversation." },
  { group: "Ask Ace", method: "DELETE", path: "/api/chat/session", about: "Forget this session's conversation." },
  { group: "Photos", method: "GET", path: "/api/photos?q=wind+turbine&count=3", about: "Unsplash photographs for a search (with photographer credits). Needs UNSPLASH_ACCESS_KEY on the server.", tryIt: true },
  { group: "Live", method: "GET", path: "/api/grid", about: "The South West grid this half hour: generation mix and carbon intensity (National Grid ESO), cached for 10 minutes.", tryIt: true },
  { group: "Live", method: "GET", path: "/api/environment", about: "Weather at the site (OpenWeather) plus any demo override: cloud, rain, fog, time of day.", tryIt: true },
  { group: "Screens", method: "GET", path: "/api/screens", about: "Animation actions a phone can trigger, and how many screens are connected.", tryIt: true },
  { group: "Screens", method: "POST", path: "/api/screens/command", about: "Animate the screen your chat session belongs to ({ action }); rate-limited per screen." },
];
