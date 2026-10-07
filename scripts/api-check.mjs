// Checks every endpoint of a running server and says which work, which work only through a
// fallback, and which fail (and why). Run with the server up:
//
//   npm start                      (in one terminal)
//   npm run check:api              (in another)  [-- http://host:port]
//
// PASS  = works as designed.  WARN = works through a fallback or needs something external
// (live ACE API, TimescaleDB, API keys).  FAIL = broken.  Exit code is 1 if anything FAILs.

import WebSocket from "ws";

const BASE = (process.argv[2] || "http://localhost:4100").replace(/\/$/, "");
const results = [];

async function check(name, fn) {
  const t0 = performance.now();
  let outcome;
  try {
    outcome = await fn();
  } catch (err) {
    outcome = { level: "FAIL", note: err.message };
  }
  const ms = Math.round(performance.now() - t0);
  results.push({ name, ms, ...outcome });
}

async function http(path, { method = "GET", body, headers = {}, redirect = "follow" } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    redirect,
    signal: AbortSignal.timeout(25_000),
  });
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { res, json, text };
}

const pass = (note = "") => ({ level: "PASS", note });
const warn = (note) => ({ level: "WARN", note });
const fail = (note) => ({ level: "FAIL", note });

// ---------------------------------------------------------------- live data
let live;
await check("GET  /api/state", async () => {
  const { res, json } = await http("/api/state");
  live = json;
  if (!res.ok || !json?.now) return fail(`HTTP ${res.status}`);
  if (json.mode === "simulate") return warn("server is in simulate mode (not real data)");
  if (!json.connected) return warn("ACE live API not reachable — serving last known values");
  return pass(`${json.now.activePowerKw} kW, ${json.now.windSpeed} m/s, ${json.now.rotorRpm} rpm`);
});

await check("WS   /ws (state + environment push)", () =>
  new Promise((resolve) => {
    const ws = new WebSocket(BASE.replace(/^http/, "ws") + "/ws");
    const got = new Set();
    const done = (r) => {
      clearTimeout(timer);
      ws.terminate();
      resolve(r);
    };
    const timer = setTimeout(() => done(fail(`only received: ${[...got].join(", ") || "nothing"}`)), 6000);
    ws.on("message", (m) => {
      try {
        got.add(JSON.parse(m).type);
      } catch {
        // ignore
      }
      if (got.has("state") && got.has("environment")) done(pass("state + environment messages received"));
    });
    ws.on("error", (e) => done(fail(e.message)));
  })
);

await check("GET  /api/config", async () => {
  const { res, json } = await http("/api/config");
  return res.ok && json?.publicOrigin ? pass(json.publicOrigin) : fail(`HTTP ${res.status}`);
});

await check("GET  /api/environment", async () => {
  const { res, json } = await http("/api/environment");
  if (!res.ok) return fail(`HTTP ${res.status}`);
  if (!json.weather) return warn(`no weather yet (${json.weatherError || "unknown"}) — screens use an estimated sky`);
  return pass(`${json.weather.place || "site"}: ${json.weather.tempC}°C, ${json.weather.condition}, cloud ${Math.round(json.weather.cloudCover * 100)}%`);
});

await check("GET  /api/weather", async () => {
  const { res, json } = await http("/api/weather");
  if (res.status === 503) return warn("weather not available (no OPENWEATHER_API_KEY, or OpenWeather unreachable)");
  return res.ok && json?.source ? pass(json.source) : fail(`HTTP ${res.status}`);
});

// ---------------------------------------------------------------- history
await check("GET  /api/history?hours=24", async () => {
  const { res, json } = await http("/api/history?hours=24");
  if (res.status === 502) return warn("ACE live API unreachable from this server");
  if (!res.ok) return fail(`HTTP ${res.status} ${json?.error || ""}`);
  return pass(`${json.timestamps?.length ?? 0} points`);
});

await check("GET  /api/history/daily", async () => {
  const { res, json } = await http("/api/history/daily?limit=30");
  if (!res.ok) return fail(`HTTP ${res.status}`);
  return Array.isArray(json) && json.length ? pass(`${json.length} days`) : warn("empty — the SQLite sync has not stored any days yet");
});

await check("GET  /api/history/compare", async () => {
  const { res, json } = await http("/api/history/compare");
  if (!res.ok) return fail(`HTTP ${res.status}`);
  return json?.todayVsYesterday || json?.summary ? pass() : warn("no comparison yet — needs stored history");
});

await check("GET  /api/history/records", async () => {
  const { res } = await http("/api/history/records");
  if (res.status === 503) return warn("TimescaleDB not running (docker compose up -d, then ingest the Zenodo data)");
  return res.ok ? pass() : fail(`HTTP ${res.status}`);
});

await check("GET  /api/history/power-curve", async () => {
  const { res, json } = await http("/api/history/power-curve");
  if (!res.ok) return fail(`HTTP ${res.status}`);
  return json.empirical?.length ? pass(`${json.empirical.length} measured bins`) : warn("reference curve only (no TimescaleDB data)");
});

// ---------------------------------------------------------------- open data
await check("GET  /api/datasets/list", async () => {
  const { res, json } = await http("/api/datasets/list");
  return res.ok && json?.["10m_scada"] ? pass(`${Object.keys(json).length} datasets`) : fail(`HTTP ${res.status}`);
});

let downloadUrl;
await check("POST /api/datasets/request", async () => {
  const { res, json } = await http("/api/datasets/request", { method: "POST", body: { name: "API check", email: "check@example.org", organization: "test", purpose: "api-check", datasetType: "daily" } });
  if (!res.ok) return fail(`HTTP ${res.status} ${json?.error || ""}`);
  downloadUrl = json.downloadUrl;
  return json.emailSent ? pass("link emailed") : warn("link returned in the response (no RESEND_API_KEY, so no email)");
});

await check("GET  /api/datasets/download?token=…", async () => {
  if (!downloadUrl) return warn("skipped (no link)");
  const { res, text } = await http(new URL(downloadUrl).pathname + new URL(downloadUrl).search);
  if (res.ok) return pass("file served");
  if (/not found on server disk/i.test(text)) return warn("Parquet file missing: put the Zenodo files in data/zenodo/");
  return fail(`HTTP ${res.status} ${text.slice(0, 80)}`);
});

await check("GET  /api/datasets/download (no token)", async () => {
  const { res } = await http("/api/datasets/download");
  return res.status === 400 ? pass("rejected as expected") : fail(`expected 400, got ${res.status}`);
});

// ---------------------------------------------------------------- chat
let token;
await check("POST /api/chat/session", async () => {
  const { res, json } = await http("/api/chat/session", { method: "POST", body: { screen: "students" } });
  token = json?.token;
  return res.ok && token ? pass() : fail(`HTTP ${res.status}`);
});

await check("POST /api/chat/stream (SSE reply)", async () => {
  if (!token) return fail("no session token");
  const res = await fetch(BASE + "/api/chat/stream", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ message: "How fast are your blades spinning right now?" }), signal: AbortSignal.timeout(60_000) });
  if (!res.ok) return fail(`HTTP ${res.status}`);
  const text = await res.text();
  const tokens = (text.match(/event: token/g) || []).length;
  const hasDone = text.includes("event: done");
  const llm = /LLM .* failed|using fallback/.test(text);
  if (!tokens || !hasDone) return fail(`stream ended without a reply (${tokens} tokens, done=${hasDone})`);
  return pass(`${tokens} streamed chunks${llm ? " (fallback)" : ""}`);
});

await check("GET  /api/chat/history (own session)", async () => {
  const { res, json } = await http("/api/chat/history", { headers: { Authorization: `Bearer ${token}` } });
  return res.ok && json.messages?.length >= 2 ? pass(`${json.messages.length} messages remembered`) : fail(`HTTP ${res.status}, ${json?.messages?.length ?? 0} messages`);
});

await check("GET  /api/chat/history (other visitor sees nothing)", async () => {
  const other = (await http("/api/chat/session", { method: "POST", body: { screen: "students" } })).json.token;
  const { json } = await http("/api/chat/history", { headers: { Authorization: `Bearer ${other}` } });
  return json.messages.length === 0 ? pass("isolated") : fail("another session can read this conversation!");
});

await check("GET  /api/chat/history (forged token)", async () => {
  const { res } = await http("/api/chat/history", { headers: { Authorization: "Bearer abc.students.forged" } });
  return res.status === 401 ? pass("rejected") : fail(`expected 401, got ${res.status}`);
});

await check("DELETE /api/chat/session", async () => {
  const { res } = await http("/api/chat/session", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  return res.ok ? pass() : fail(`HTTP ${res.status}`);
});

// ---------------------------------------------------------------- screens
await check("GET  /api/screens", async () => {
  const { res, json } = await http("/api/screens");
  return res.ok && json.actions?.length ? pass(`${json.actions.length} actions, connected: ${JSON.stringify(json.connected)}`) : fail(`HTTP ${res.status}`);
});

await check("POST /api/screens/command", async () => {
  const t = (await http("/api/chat/session", { method: "POST", body: { screen: "college" } })).json.token;
  const { res, json } = await http("/api/screens/command", { method: "POST", headers: { Authorization: `Bearer ${t}` }, body: { action: "overview" } });
  if (res.ok) return pass("delivered to a connected screen");
  if (/not connected/i.test(json?.reason || "")) return warn("works, but no screen is open — open /screen/college first");
  return fail(`HTTP ${res.status} ${json?.reason || ""}`);
});

await check("POST /api/screens/command (bad action)", async () => {
  const t = (await http("/api/chat/session", { method: "POST", body: { screen: "college" } })).json.token;
  const { res } = await http("/api/screens/command", { method: "POST", headers: { Authorization: `Bearer ${t}` }, body: { action: "format c:" } });
  return res.status === 400 ? pass("rejected as expected") : fail(`expected 400, got ${res.status}`);
});

// ---------------------------------------------------------------- demo API (only when enabled)
await check("GET  /api/admin/presets (demo API)", async () => {
  const { res } = await http("/api/admin/presets", { headers: process.env.ADMIN_TOKEN ? { "X-Admin-Token": process.env.ADMIN_TOKEN } : {} });
  if (res.status === 404) return warn("disabled (production without ADMIN_TOKEN) — by design");
  if (res.status === 401) return warn("needs ADMIN_TOKEN (set it in this shell to test)");
  return res.ok ? pass() : fail(`HTTP ${res.status}`);
});

// ---------------------------------------------------------------- website
for (const path of ["/", "/developers", "/screen/students", "/screen/community", "/screen/college", "/ask/community"]) {
  await check(`GET  ${path} (page)`, async () => {
    const { res, text } = await http(path);
    if (res.status === 200 && text.includes('id="root"')) return pass();
    if (/Frontend not built/.test(text)) return fail("frontend not built — run npm run build");
    return fail(`HTTP ${res.status}`);
  });
}

// ---------------------------------------------------------------- report
const icon = { PASS: "✔", WARN: "▲", FAIL: "✘" };
const width = Math.max(...results.map((r) => r.name.length));
console.log(`\nAPI check against ${BASE}\n`);
for (const r of results) console.log(`${icon[r.level]} ${r.level}  ${r.name.padEnd(width)}  ${String(r.ms).padStart(5)} ms  ${r.note}`);
const count = (l) => results.filter((r) => r.level === l).length;
console.log(`\n${count("PASS")} passed · ${count("WARN")} need something external or use a fallback · ${count("FAIL")} failed\n`);
process.exit(count("FAIL") ? 1 : 0);
