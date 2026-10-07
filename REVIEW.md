# REVIEW.md — ACE public communication display: strict pre-submission review

| | |
|---|---|
| **Reviewed** | 7 Oct 2026, `main` @ `3614255` (21 days to the 28 Oct pitch) |
| **Scope** | Every `.md` file, every source file (server, scripts, public JS/HTML/CSS), docker-compose, package.json, GLB model contents, committed images. The vendored `three` copy was checked for what is used, not read line by line. |
| **Rules followed** | No project file was modified. The only file written to the repo is this one. All experiments ran on a throw-away copy in the session scratchpad. |
| **Severity** | **BLOCKER** = breaks a minimum requirement or crashes · **HIGH** = hurts a judging criterion · **MEDIUM** · **LOW** |
| **"Side by side"** | Every WRONG item shows `CURRENT (file:line)` immediately followed by `BETTER`, then a 1–2 sentence reason. Two adjacent blocks per item rather than an HTML table, so it renders anywhere. |

---

## 0. Verdict in ten lines

1. The **visual core is good**: a real-scale 3D turbine whose rotor turns at the real RPM, a clear plain-English tone, and an honest `ASSUMPTION` tag culture in `constants.js`. That is a winnable base.
2. The **trust layer is not there yet**. In a 5-minute browser test I saw the screen show *fabricated numbers as live*, *a dead backend as live*, and *two different "homes" counts at once*.
3. **Three crashes/hangs are one keystroke away**: fresh-clone `npm start` crashes; one malformed WebSocket frame kills the server; a hung ACE request freezes the display with the "live" dot still green.
4. **Several claims on screen are factually wrong** (tower height 150 m/tip 208 m; "twice as tall as Big Ben"; "£62 raised today"; "12,000 homes lit up across Lawrence Weston"; "1.77 GWh so far" when lifetime is of the order of 30+ GWh).
5. **A Windows XP "Bliss" wallpaper is the default background** (with a wallpaper-site watermark), and an Adobe Stock *watermarked comp* is committed to the repo. Both are licence problems and, for the first, a credibility problem.
6. The **architecture documented in `docs/` is not the architecture built**, and the documented one is far too heavy: TimescaleDB + SQLite + Redis + "pgvector RAG" + LLM chat + Resend email, for one turbine, one screen, three weeks. The ACE API already serves lifetime daily rollups.
7. **Judges will read the repo** ("subject to technical review"). Docs claiming pgvector, LangGraph, Chart.js, `/health`, Nginx, "100+ concurrent visitors" that do not exist cost credibility.
8. The **first 10 seconds** on a 1080p screen: a big headline about "our neighbourhood", a placeholder "2,840 Homes", a thin turbine cropped by the nav bar, **no live power number, no timestamp, no "live" cue**, 14 px status text, and debug UI (hot-nav pill, "Drag to orbit" hint, chat FAB) on a screen nobody can touch.
9. Everything below is fixable inside the time. The Top-10 list in §5 totals ≈ 35 h of work.
10. **Biggest risk to winning: showing a confident wrong or stale number to the people who own the turbine.** Details in §5.4.

### Counts

| BLOCKER | HIGH | MEDIUM | LOW |
|---|---|---|---|
| 6 | 33 | 42 | 16 |

97 findings in total, counted by script from the IDs in §2 (every ID referenced anywhere in this file is defined once). IDs are stable so you can say "fix SRV-01, ST-01, CM-02".

---

## 0.1 Evidence: what I actually ran

I did not rely on reading alone. These results are reproducible in a scratch copy (`git archive HEAD`, `npm install`, a 40-line mock ACE API).

| # | Test | Result | Findings |
|---|---|---|---|
| E1 | Fresh clone → `npm install` → `npm start` (README steps) | **Crashes immediately**: `TypeError: Cannot open database because the directory does not exist` (`server/db.js:8`). `data/` is git-ignored and never created. | SRV-02 |
| E2 | Start server with ACE API unreachable (sandbox proxy returned 403 for it) | `/api/state` serves hard-coded **185 kW / 4.8 m/s / 6.2 rpm / "today 12,400 kWh"** as the live state. `connected:false` only after 3 failures, and no page reads it. Redis error logged every ~3 s. | ST-02, ST-04, RD-03 |
| E3 | Send one masked frame with RSV1 set to `/ws` (raw TCP) | **Server process exits** with an uncaught `'error'` event on the `WebSocket` instance (`WS_ERR_UNEXPECTED_RSV_1`). | SRV-01 |
| E4 | Mock API answers 200, newest sample **3 hours old** | State stays `connected:true`, shows the old 3,100 kW as current. | ST-01 |
| E5 | Mock API answers 200 with `null` values and `quality:["bad"]` | State holds `power=null, rpm=null`; client coerces to `0` → "Blades resting peacefully". | ST-03, CM-03 |
| E6 | Mock API accepts the TCP connection and never replies | `updatedAt` froze at 10:46:28 and was still frozen 27 s later with `connected:true`. No `fetch` timeout. | AC-01 |
| E7 | Playwright, Chromium, 1920×1080, `/community.html`, 4.5 s after load | Headline/stat still the HTML placeholder **"2,840 Homes"** while the pill below says **"~8,857 local homes"**. First real story renders at ≈8.5 s. | CM-01 |
| E8 | Same page, then `kill -9` the backend, wait 25 s | Page still reads "Generating clean wind energy for ~8,857 local homes", green dot, forever. | CM-03, WS-01 |
| E9 | `POST /api/admin/preset {"preset":"rated"}` with no credentials | Accepted; whole fleet of screens now shows 4,200 kW. A concurrent in-flight poll then flipped `connected` to `false` *while in simulate mode* (race). | SRV-03, ST-06 |
| E10 | Parsed `ace_turbine.glb` | Yaw node at y=89 m, rotor-tilt offset +3 m ⇒ **hub ≈ 92 m**; 92 + 57.85 m blade ⇒ **tip ≈ 150 m**. The docs say hub 150 m / tip 207.8 m. | DOC-01 |
| E11 | `npm audit --omit=dev` | 0 vulnerabilities. | — |
| E12 | Viewed `public/img/green-hills.jpg`, `referencepics/1000_F_…jpg` | First is the **Windows XP "Bliss" photo with a wallpaper-site watermark**. Second is a **watermarked Adobe Stock comp** (ID 80929606). | INF-04 |

**What I could not verify** (state it so you can close these with ACE): the real ACE API payloads (sandbox egress to `ace-api.duckdns.org` returned 403), whether `energy_produced` is a cumulative counter or a per-interval value, the `main_status` code table, real-GPU performance, the physical kiosk PC.

---

## Step 1 — Architecture and decisions, in my own words (please check me)

### 1.1 What the project is trying to do

A kiosk web page for the Ambition Lawrence Weston community centre that turns live ACE turbine data into plain-English "what is it doing and why does it matter to us". The brief's judging criteria are accessibility, effective use of live data, community relevance, creativity, and robustness for unattended weeks. Winner by public vote after a 3-minute pitch.

### 1.2 What is actually built (runtime)

```
                       ┌──────────────────────── Node 22 / Express / ws  (server/server.js) ───────────────────────┐
ACE API (HTTPS) ──────▶│ state.js: 3 setTimeout loops  now(2 s) / today(60 s) / status(5 s)  → one in-memory state │
 /v1/sites/ace/...     │   mode "live" | "simulate"  (admin can override, no auth)                                │──WS /ws──▶ browsers
                       │ aceClient.js: fetch + retry on 429/503 + Retry-After (no timeout)                        │  (full JSON snapshot
                       │ syncJob.js        every 12 min → SQLite  data/ace_history.db   (better-sqlite3)          │   every publish ≈ 3 per 2 s)
                       │ timescaleSyncJob  every 12 min → TimescaleDB (Docker)                                    │
                       │ redisClient.js: rate-limit + chat history + live cache (memory fallback)                 │
                       │ aiAgent.js/ragKnowledge.js: keyword-matched "RAG" over the project's own .md files       │
                       │ datasetService.js: email-gated Parquet download links (HMAC token, Resend)               │
                       └────────────────────────────────────────────────────────────────────────────────────────┘
Browser pages (static, vanilla ES modules):
  community.html  3D GLB turbine (three.js) + rotating 8 s story card + photo background      ← the real product
  schools.html    cartoon SVG turbine whose face reacts to wind                                ← nice, secondary
  datascience.html power-curve canvas + records + dataset-request modal                        ← scope creep
  admin.html      preset / slider simulator that overrides the live state for ALL screens      ← unsecured
  chat-widget.js  "Ask the Turbine" FAB injected on community/schools/datascience
```

Data flow for the main screen: ACE API → `state.js` (one poller, so N browsers never hit ACE) → WebSocket JSON → `community.js` classifies a "mood" (`turbine-mood.js`), computes "homes / CO₂ / trees / £" (`metrics.js`), picks a story (`stories-community.js`) every 8 s, and feeds RPM to the 3D rotor (`three-turbine.js`).

### 1.3 Decisions documented in the `.md` files (numbered so §4 can answer them)

| ID | Documented decision | Where |
|---|---|---|
| D1 | Four audience experiences (community, schools, data science, admin) + 8-scene blueprint | README, PUBLIC_EXPERIENCE_BLUEPRINT |
| D2 | TimescaleDB hypertable + continuous aggregate for history; ingest Zenodo Parquet; live sync every 12 min | SYSTEM_DESIGN §7, README |
| D3 | Redis for sessions, rate-limit, hot cache | SYSTEM_DESIGN §8, PRUNING |
| D4 | "Ask the Turbine" LLM chat (Gemini → Groq → local), pgvector RAG, LangGraph router | SYSTEM_DESIGN §13–15 |
| D5 | Email-gated researcher dataset delivery via Resend + 24 h HMAC token | SYSTEM_DESIGN §16 |
| D6 | Homes powered = kW ÷ 0.35 (README/Blueprint/code) **or** ÷ 0.9 (SYSTEM_DESIGN, chat) | metrics.js, SYSTEM_DESIGN §12 |
| D7 | Community fund = MWh × £5 and show it as "raised today" | constants.js:28 |
| D8 | When the API is down, "transition to an ambient simulation mode based on historical averages" | DATA_SOURCES.md:98 (also :26) |
| D9 | Turbine spec: hub 150 m, tip 207.8 m, "tallest onshore in England" | PROJECT_OVERVIEW:12, DATA_DICTIONARY:195–197 |
| D10 | Kiosk = `chromium --kiosk` on a PC that runs Node (and Docker for Timescale/Redis) | README:96–101 |
| D11 | Deploy on a Contabo VPS behind Nginx for "100+ concurrent visitors" | SYSTEM_DESIGN §18 |
| D12 | Interactive 3D with orbit/zoom, `B` to swap backgrounds, hot-corner switcher | README:14–20, :64–76 |
| D13 | The project's own `.md` files are the chatbot's knowledge base | ragKnowledge.js:9–18 |
| D14 | Prune Kafka, S3/MinIO, Next.js, Mem0, Tavily, microservices (keep Timescale, pgvector, Redis, LLM adapter, Resend) | ARCHITECTURE_PRUNING |

### 1.4 What the docs claim vs what exists

| Doc claim | Reality |
|---|---|
| pgvector knowledge base, `knowledge_documents`, HNSW index (SYSTEM_DESIGN §15) | **None.** `ragKnowledge.js` is an in-memory term-frequency matcher over `.md` files. |
| LangGraph intent router (§13.2) | **None.** `aiAgent.js:103` is a regex `analyzeIntent`. |
| Chart.js time-series (§10) | **None.** Hand-drawn canvas in `datascience.js`. |
| `/health`, `/api/live`, `/api/history`, `/api/daily-rollup`, `/api/records` (§20) | `/health` and `/api/live` do not exist; `/api/history` exists but proxies ACE directly (the thing §6 says never to do). |
| `app` Docker service, `build: .`, Nginx, systemd (§18) | No Dockerfile; `docker-compose.yml` has only Timescale + Redis. |
| "Sub-second telemetry", "< 100 ms", "100+ simultaneous visitors" (§1, §2) | State polls every **2 s** (`state.js:165`); no load test exists. |
| "Phase 1 DONE: 11,213 rows ingested" / "all-time records" | The DB holds **~78 days** (from 2026-07-21, `timescaleSyncJob.js:29`). The turbine has run since March 2023. |
| `status` field `RUNNING` etc. in snapshot (§9.1) | Snapshot has no `status`, `is_live` or `age_seconds`. `aiAgent.js:22` reads `cached.now.status`, which never exists. |

### 1.5 My assumptions about intent (tell me if wrong)

1. The pitch is judged mostly on the **community screen**; the other pages are bonus.
2. The kiosk PC is a **modest Windows/Linux PC with a HDMI TV (~1080p)**, a browser, **no keyboard/touch** in normal operation.
3. You are free to **host the app elsewhere** (VPS, Fly, Render…) and point the kiosk at a URL, or run Node locally. Docs mention both.
4. You can ask ACE (Charlie Plumley) for facts: heights, the real community-fund figure, photo permission.

---

## Step 2 — File-by-file review (server side)

> Convention: **RIGHT** = keep. **WRONG** items carry an ID and severity; each is followed by `CURRENT` and `BETTER`. Line numbers are real line numbers in the file.

### 2.1 `server/server.js` (310 lines)

**RIGHT**
- One shared poller fanned out over WebSocket (`onStateChange` → `wss.clients`, `server.js:292–298`) is the correct "single ingestion boundary": N screens ≠ N ACE requests. The comment in `aceClient.js` records that browsers polling independently caused 429s. Keep exactly this idea.
- Initial snapshot sent on connect (`:238`) so a reloaded kiosk is never blank. Good.
- Parameterised SQL everywhere I looked; `getDatasetFilePath` uses a fixed map, so no path traversal.
- Redirect `/` → `/community.html` (`:47`) is the right kiosk default.

**WRONG**

**SRV-01 · BLOCKER · One malformed WebSocket frame kills the whole server** (verified, E3)
`ws` emits `'error'` on the socket; with no listener Node throws and the process exits. Any scanner, buggy client or bad proxy can do this. There is also no heartbeat, so half-open sockets (Wi-Fi drop at the community centre) accumulate in `wss.clients` forever, and no `maxPayload`.

CURRENT `server/server.js:234-238`
```js
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (socket) => {
  // Push initial live state
  socket.send(JSON.stringify(getState()));
```
BETTER
```js
const wss = new WebSocketServer({ server: httpServer, path: "/ws", maxPayload: 2048 });

wss.on("connection", (socket) => {
  socket.isAlive = true;
  socket.on("pong", () => { socket.isAlive = true; });
  socket.on("error", (err) => console.warn("[WS] client error:", err.code ?? err.message));
  socket.send(JSON.stringify(snapshot()));          // snapshot() defined in ST-01
});

// drop dead peers, keep the Set small over weeks of uptime
setInterval(() => {
  for (const s of wss.clients) {
    if (!s.isAlive) { s.terminate(); continue; }
    s.isAlive = false; s.ping();
  }
}, 15_000).unref();

// last line of defence: die loudly, let systemd/Docker restart us (see INF-01)
for (const sig of ["uncaughtException", "unhandledRejection"])
  process.on(sig, (e) => { console.error(`FATAL ${sig}:`, e); process.exit(1); });
```
*Why:* the listener turns a process-killing event into a log line; the heartbeat bounds memory; exit-and-restart is safer on a kiosk than limping on in an unknown state.

**SRV-03 · HIGH · Unauthenticated admin API can put fake data on every public screen** (verified, E9)
`/api/admin/*` is open, `admin.html` is statically served, and `hotkey-nav.js:37` links to it from every public page. Simulate mode never expires and the community page shows it only as a different *dot colour* (`community.js:83-84`). If this server is exposed on the VPS (SYSTEM_DESIGN §18), anyone can show "4,200 kW / storm / fault" on the community-centre TV.

CURRENT `server/server.js:140-158`
```js
app.get("/api/admin/presets", (_req, res) => { res.json(PRESETS); });
app.post("/api/admin/preset", (req, res) => { const ok = applyPreset(req.body?.preset); ... });
app.post("/api/admin/simulate", (req, res) => { setSimulatedState(req.body ?? {}); res.json(getState()); });
app.post("/api/admin/resume-live", (_req, res) => { resumeLive(); res.json(getState()); });
```
BETTER
```js
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;            // unset ⇒ admin disabled entirely
const requireAdmin = (req, res, next) =>
  ADMIN_TOKEN && req.get("x-admin-token") === ADMIN_TOKEN ? next() : res.sendStatus(404);
app.use("/api/admin", requireAdmin);
// and don't serve admin.html unless ADMIN_TOKEN is set:
app.get("/admin.html", (req, res, next) => (ADMIN_TOKEN ? next() : res.sendStatus(404)));

// state.js — simulation can never outlive a rehearsal
let simTimer;
export function setSimulatedState(v) { /* …existing… */ clearTimeout(simTimer); simTimer = setTimeout(resumeLive, 10 * 60_000); simTimer.unref?.(); }
```
*Why:* 404 for anyone without the token, and a forgotten demo reverts to live by itself after 10 minutes. The `freshness:"demo"` banner in ST-01 makes simulation unmistakable on screen.

**SRV-04 · MEDIUM · Every static request is `console.log`ged** (`:40-43`)
Chromium fetching ~30 files per page load, plus reloads, forever, into whatever captures stdout (journald/Docker json-file with no rotation by default). Also logs full query strings.

CURRENT
```js
app.use((req, res, next) => { console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`); next(); });
```
BETTER
```js
app.use("/api", (req, _res, next) => { if (req.path !== "/state") console.log(req.method, req.path); next(); });
```
*Why:* signal only; log growth stays negligible over weeks.

**SRV-05 · MEDIUM · `/api/history` forwards every call to the ACE API, uncached, unvalidated** (`:109-129`)
Contradicts your own "no public visitor ever triggers an upstream call" rule (SYSTEM_DESIGN §6) and the API's 1 Hz etiquette: N judges opening the Data Science page = N upstream range queries; `hours` is user-controlled (`Number(req.query.hours)` can be `NaN`, negative or fractional).

CURRENT
```js
const hours = Math.min(24 * 30, Number(req.query.hours) || 24);
const resolution = hours > 48 ? "daily" : "10m";
const data = await getWecStdRange([...], { resolution, start: ..., end: ..., pageSize: 5000 });
```
BETTER (or delete with the Data Science page, see §5.3)
```js
const BUCKETS = { "24": "10m", "720": "daily" };                 // two fixed windows only
const memo = new Map();                                           // key → {at, body}
app.get("/api/history", async (req, res) => {
  const hours = req.query.hours === "720" ? 720 : 24;
  const hit = memo.get(hours);
  if (hit && Date.now() - hit.at < 5 * 60_000) return res.json(hit.body);
  /* …fetch once… */ memo.set(hours, { at: Date.now(), body });
  res.json(body);
});
```
*Why:* upstream load is bounded to 2 calls per 5 minutes regardless of visitors.

**SRV-06 · MEDIUM · Chat/dataset endpoints are abusable** (`:161-231`, `:245`)
Rate-limit key is the *client-supplied* `sessionId` (`:163`, `:245`) so rotating it bypasses the limit; the design doc promises a per-IP limit that does not exist; `/api/datasets/request` has no limit at all (see DS-02). *BETTER:* delete these endpoints (§5.3). If you keep any: key on `req.ip`, not on a body field.

**SRV-07 · LOW · Operational gaps** — listens on all interfaces (`:304`); no `/health`; no graceful `SIGTERM`; `startSyncJob`+`startTimescaleSyncJob` both run (`:301-302`, duplicates, see DB-01).
BETTER:
```js
app.get("/health", (_req, res) => { const s = snapshot(); res.status(s.freshness === "offline" ? 503 : 200).json({ freshness: s.freshness, ageSec: s.ageSec }); });
httpServer.listen(PORT, process.env.HOST || "127.0.0.1");
process.on("SIGTERM", () => httpServer.close(() => process.exit(0)));
```
*Why:* a supervisor/uptime monitor can finally tell "up but stale" from "healthy".

---

### 2.2 `server/state.js` (257 lines) — **the most important file in the repo**

**RIGHT**
- Single source of truth shared by all screens; display pages "don't know which mode" they're in (header comment). Clean separation.
- Self-rescheduling `setTimeout` loops (`:156-193`) instead of `setInterval`: no overlapping polls, and each loop is wrapped so one exception can't stop it.
- 2 s cadence with two requests per tick stays within the API's "≤ 1 Hz" rule (careful: if you ever drop to 1 s, you double the request rate, see ST-07).
- `PRESETS` (`:206-242`) are a genuinely useful rehearsal tool for low-wind / curtailed / fault states, and the only way to demo them on stage. Keep (hardened, SRV-03).

**WRONG**

**ST-01 · BLOCKER · Stale data is shown as live** (verified, E4, E6)
The code never looks at the sample's own timestamp. `publish()` stamps `updatedAt = now` on *every* publish, including failures (`:31-41`, `:98`), and `connected` is `true` after any success. A 200 response containing hour-old data, or a hang, looks identical to a healthy feed. The Plan in your own `WDW_public_display.docx` (Day 2: "stale-data detection", Day 4: states `NO DATA … DATA DELAYED`) was not implemented.

CURRENT `server/state.js:83-94, 98, 142-145`
```js
state.now = {
  activePowerKw: last(wec.series?.wec_active_power),
  windSpeed: last(wec.series?.wec_wind_speed),
  ...
};
onFetchSuccess();                 // connected = true, regardless of how old the sample is
...
publish();                        // updatedAt = new Date() even after a failure
```
BETTER
```js
// ---- state.js: tell the truth about freshness ----
const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);

function newest(res, field) {                       // newest *good* sample of one field
  const v = res?.series?.[field];
  const i = Array.isArray(v) ? v.length - 1 : -1;
  if (i < 0 || res.quality?.[i] === "bad") return { value: null, atMs: null };
  return { value: num(v[i]), atMs: Number(res.timestamps?.[i]) / 1000 };   // API ts = epoch µs
}

// in pollNowOnce(), after the awaits:
if (state.mode !== "live") return;                 // see ST-06
const p = newest(wec, "wec_active_power"), r = newest(wec, "wec_rotor_speed");
state.now = {
  activePowerKw: p.value, rotorRpm: r.value,
  windSpeed: newest(wec, "wec_wind_speed").value,
  nacelleDeg: newest(wec, "wec_nacelle_position").value,
  lifetimeEnergyKwh: newest(wec, "wec_energy_exported").value,
  /* …curtailment fields… */
};
state.nowSampleAt = p.atMs;                        // time of the ACE reading, not of our poll

export function snapshot() {
  const ageSec = state.nowSampleAt ? (Date.now() - state.nowSampleAt) / 1000 : null;
  const freshness =
    state.mode === "simulate" ? "demo" :
    ageSec == null            ? "connecting" :
    ageSec < 15               ? "live" :
    ageSec < 120              ? "delayed" : "offline";
  return { ...state, serverTime: Date.now(), ageSec, freshness };
}
setInterval(publish, 1000).unref();                // heartbeat so ageSec keeps growing even if polls hang
```
*Why:* freshness is derived from ACE's own timestamps and from the clock, so *every* failure mode (error, hang, empty, old data) degrades the same visible way. The client shows `live / delayed / offline / demo` (CM-03).

**ST-02 · BLOCKER · Invented numbers are the initial "live" state** (verified, E2)
On cold start, or when the API is down at boot, the display shows 185 kW, 4.8 m/s, 6.2 rpm, "today 12,400 kWh", `main_status:0` ("generating") and lifetime 34.5 GWh as if measured.

CURRENT `server/state.js:10-27`
```js
now: { activePowerKw: 185.0, windSpeed: 4.8, aggregateWindDir: 210, nacelleDeg: 215, rotorRpm: 6.2,
       lifetimeEnergyKwh: 34500000, operatingHours: 19500, ... },
today: { energyKwh: 12400, avgWindSpeed: 5.4 },
statusEvent: { main_status: 0, ... },
```
BETTER
```js
const state = { mode: "live", now: null, nowSampleAt: null, today: null, statusEvent: null };
```
and clients render a "Connecting to the turbine…" screen while `now === null` (CM-01). *Why:* `null` is a state the UI can handle honestly; a plausible fake is a lie the UI cannot detect. **This also overturns decision D8** (see §4).

**ST-03 · HIGH · `null`/`undefined` pass straight through and become `0` on screen** (verified, E5)
`last()` (`:52-54`) returns `undefined` for empty series and `null` for bad samples. `community.js:90-92` then coerces non-numbers to `0`, so a *sensor gap* reads as "Blades resting peacefully in calm coastal air" (`community.js:100`). CURRENT `:52-54`; BETTER `newest()`/`num()` above, plus in the UI: `null` ⇒ show "–" and the "delayed" chip, never `0`.

**ST-04 · HIGH · `connected` is wrong and unused**
One shared `consecutiveFailures` counter is reset by *any* of three pollers succeeding (`:142-145`), so `/status` working while `/now` fails keeps `connected:true`. And no page reads `snapshot.connected`. BETTER: delete it; use `freshness` (ST-01).

**ST-05 · MEDIUM · "Today" is UTC-midnight, misses the first interval, and can be `undefined`**
CURRENT `:104-121`
```js
const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
... energyKwh: Math.max(0, latestEnergy - startEnergy)   // latest − *first row after* midnight
```
(a) In BST "today" starts at 01:00 local. (b) Energy generated between 00:00 and the first 10-min row is dropped (up to 10 min of output). (c) It assumes `energy_produced` is a cumulative counter (docs say so; unverified, see DB-03). (d) The result is `undefined` just after midnight, which `community.js:125` then *invents* (CM-02).
BETTER — use the lifetime meter you already poll every 2 s and one 60 s reading at London midnight:
```js
const londonMidnight = (d = new Date()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hourCycle: "h23",
    hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d).map(x => [x.type, x.value]));
  return new Date(d - (((+p.hour * 60 + +p.minute) * 60 + +p.second) * 1000 + d.getMilliseconds()));
};
// pollTodayOnce():
const mid = londonMidnight();
const r = await getWecRange(["wec_energy_exported"], { resolution: "60s",
  start: mid.toISOString(), end: new Date(+mid + 5 * 60_000).toISOString(), pageSize: 5 });
const atMidnight = (r.series?.wec_energy_exported ?? []).find(Number.isFinite);
const kwh = Number.isFinite(atMidnight) && state.now?.lifetimeEnergyKwh != null
  ? Math.max(0, state.now.lifetimeEnergyKwh - atMidnight) : null;
state.today = { energyKwh: kwh, since: mid.toISOString() };
```
*Why:* London day, no missed interval, and `null` (not a guess) when unknown. `getWecRange` = `getWecStdRange` pointed at `wec_instantaneous` (verify that family allows `60s` range for `wec_energy_exported`; API_REFERENCE §4.3 says asset-scoped range supports `60s`).

**ST-06 · MEDIUM · Race: an in-flight live poll overwrites simulate mode** (observed in E9)
`pollNowOnce` checks `mode` only before the `await` (`:57`), then writes `state.now`/`state.connected` after it (`:83-97`).
BETTER: re-check after every `await` (`if (state.mode !== "live") return;`, shown in ST-01) and in `onFetchFailure`.

**ST-07 · LOW · Config drift and a halving opportunity**
`POLL_NOW_MS = 1000` (`constants.js:31`) is imported but unused; the real cadence is hard-coded `2000` (`:165`). And two requests per tick are not needed: `wec_instantaneous` carries power, wind, rpm, nacelle position, lifetime energy *and* `wec_available_power_after_external_setpoints` (DATA_DICTIONARY §1.2), so the `site_instantaneous` call can go. BETTER: one request per tick at 1 s (still ≤ 1 Hz), `setTimeout(loopNow, POLL_NOW_MS)`. *Why:* half the upstream load, one fewer partial-failure mode, smoother rotor.

**ST-08 · MEDIUM · Status decoding rests on an unverified table**
`DATA_DICTIONARY.md:178` ("`0` Ready, `1` Paused, `2` Starting, `9` Fault/Maintenance") feeds `turbine-mood.js:28,37`. The `ingest_zenodo.py:163` column order suggests someone looked at real rows, but nothing in the repo confirms the *meaning* of each code. A wrong mapping would show **"Stopped for safety"** or **"Technicians on site"** on a healthy turbine. BETTER: classify with physical signals first (rpm, power, wind) and use only the explicit `fault_message_flag` / `service_flag` booleans from the status feed; confirm codes with ACE (see §6).

---

### 2.3 `server/aceClient.js` (98 lines)

**RIGHT**
- Honest `User-Agent` (`:29`), exactly what API_REFERENCE §2 asks for.
- `Retry-After`-aware backoff on 429/503 and strictly sequential retries (`:32-37`).
- Thin, readable endpoint wrappers (`getSiteLatest`, `getWecLatest`, …).

**WRONG**

**AC-01 · HIGH · No request timeout, so one hung connection freezes live data** (verified, E6)
Node's default `fetch` will wait minutes. Because the poll loop `await`s the call, the loop itself stops, and nothing marks the data stale (ST-01).

CURRENT `server/aceClient.js:27-30`
```js
const res = await fetch(url.toString(), {
  method: "GET",
  headers: { Accept: "application/json", "User-Agent": "ACE-Community-Display/2.0" },
});
```
BETTER
```js
const res = await fetch(url, {
  headers: { Accept: "application/json", "User-Agent": "ACE-Community-Display/2.0" },
  signal: AbortSignal.timeout(8_000),
});
```
*Why:* an 8 s ceiling turns a hang into a normal, retried, counted failure.

**AC-02 · LOW · Retries on non-retryable errors; `Retry-After` can be a date or huge**
CURRENT `:19-24, 34`: a 400/404 (bad field name) is thrown inside the `try`, caught, and retried 3× with sleeps (≈3.5 s per poll); `Number(res.headers.get("Retry-After"))` is `NaN` for HTTP-dates and unbounded.
BETTER:
```js
if (!res.ok) { const e = new ApiError(`HTTP ${res.status} for ${path}`, res.status, await safeJson(res)); e.fatal = res.status >= 400 && res.status < 500 && res.status !== 429; throw e; }
...
} catch (err) { lastErr = err; if (err.fatal || attempt === retries) break; ... }
const retryAfter = Math.min(60, Number(res.headers.get("Retry-After")) || 2 ** attempt);
```

---

### 2.4 `server/db.js`, `syncJob.js` (SQLite) and `scripts/ingest_zenodo.py`

**RIGHT**
- `ON CONFLICT … DO UPDATE` upserts are idempotent; the batch is a single transaction (`db.js:106-117`).
- The *intention* of grouping days by Europe/London is right (energy "today" must be a local day).

**WRONG**

**SRV-02 · BLOCKER · Fresh clone cannot start** (verified, E1)
CURRENT `server/db.js:6-8`
```js
const DB_PATH = path.join(__dirname, "..", "data", "ace_history.db");
const db = new Database(DB_PATH);        // data/ is in .gitignore ⇒ directory doesn't exist ⇒ throws at import time
```
BETTER (if SQLite survives at all; see DB-01)
```js
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
```
*Why:* `npm install && npm start` is the README's own recipe and the first thing a reviewer tries.

**DB-01 · MEDIUM · Two databases for the same data, both fed by two sync jobs**
`db.js` (SQLite) and `timescaleDb.js` (Postgres) define the same `scada_10m`/`daily_rollup`; `server.js:301-302` starts both jobs, hitting ACE twice every 12 min for the same range. The `/api/history/daily` and fallback `compare` still read SQLite; `records`/`power-curve` read Timescale; the chat reads Timescale. A reader cannot tell which is truth. BETTER: **neither** (§5.3 / D2): the API's `daily` resolution has lifetime retention, so "record day / lifetime / this month vs last" can be fetched in one cached call.

**DB-02 · HIGH · The "history" starts on 2026-07-21, not March 2023** (`syncJob.js:23`, `timescaleSyncJob.js:29`)
Hard-coded fallback start `"2026-07-21T10:40:00Z"` plus an ingest script that expects `data/zenodo/*.parquet` that no doc tells you how to download. Result: the UI's "all-time record", "so far", "78 Days · 2,924 Homes" (`datascience.html:58`) and the chat's "first 78 days of operation" describe ~11,200 rows, i.e. **5 % of the turbine's life**, while another card shows a ~34 GWh lifetime.
BETTER: remove the stored history; for "since 2023" use `wec_energy_exported` (already live), for records use the API `daily` family:
```js
const r = await getWecStdRange(["energy_produced", "active_power_max", "wind_speed_max"],
  { resolution: "daily", start: "2023-03-29T00:00:00Z", end: new Date().toISOString(), pageSize: 5000 });
// ~1,300 rows, one page. Sanity-filter before trusting: kWh/day ≤ 24 × 4245 and ≥ 0.
```
*Why:* no ingestion pipeline, no download step, no 78-day lie. (Verify first that `energy_produced` at `daily` is per-day, not cumulative, see DB-03.)

**DB-03 · MEDIUM · Daily energy = `MAX − MIN` of `energy_produced`, whose semantics are unverified**
CURRENT `db.js:63`; same in `init_timescaledb.sql:59`
```sql
ROUND(MAX(energy_produced) - MIN(energy_produced), 1) AS energy_kwh
```
If the counter is cumulative this drops the energy between day D's last row and day D+1's first (≈ 0.7 %/day), and *any* counter glitch becomes a giant "record day". If it is per-interval it is simply wrong (should be `SUM`). The docs contradict themselves (SYSTEM_DESIGN §7.1 `energy_kwh` + `SUM`; DATA_DICTIONARY `energy_produced` = "cumulative").
BETTER — verify once, in 5 minutes, then encode the answer:
```sql
-- over one full day: if these two agree ≈, energy_produced is cumulative
SELECT MAX(energy_produced)-MIN(energy_produced) AS delta, SUM(active_power_mean)/6 AS integrated_kwh FROM scada_10m WHERE ts >= '2026-09-18' AND ts < '2026-09-19';
```
and compute per-day energy as `last_value − first_value_of_next_day` (or `LEAD()`), never `MAX−MIN`.

**DB-04 · LOW · Hand-rolled DST in SQLite** (`db.js:50-54`)
`'03'` and day ≥ 25 ⇒ BST, `'10'` and day < 25 ⇒ BST. BST actually flips on the last Sunday, so 25–28 Mar (and 25–31 Oct before the Sunday) are wrong by an hour. Moot if SQLite goes; otherwise do it in JS with `Intl` (ST-05).

---

### 2.5 `server/timescaleDb.js`, `timescaleSyncJob.js`, `scripts/init_timescaledb.sql`, `scripts/ingest_zenodo_timescale.py`

**RIGHT**
- Graceful degradation when Postgres is down (`isDbAvailable`, sync job skips) is correct in spirit: live display never depends on history.
- Binding Postgres/Redis to `127.0.0.1` in compose (`docker-compose.yml:7,21`) is the right default.
- Continuous aggregate with `time_bucket(…,'Europe/London')` is a correct way to get local days *if* you need a DB.

**WRONG**

**DB-05 · HIGH · "All-time" statistics are mislabelled and contradict each other**
`getTimescaleRecords()` (`:108-168`) is called "all-time records" by the UI and chat but covers ~78 days (DB-02). `total_energy_kwh` is a sum of daily deltas, so it also loses the inter-day increments. On the community story: *"Over 1.77 GWh of clean energy produced so far"* (`community.js:164`) sits next to a lifetime meter of the order of 30+ GWh.
BETTER: show `lifetimeEnergyKwh` (the meter) for "since 2023", and label any DB-derived number with its date range ("best day since 21 Jul 2026") or drop it.

**DB-06 · HIGH · "Records" are not sanity-checked**
CURRENT `:113` `ORDER BY active_power_max DESC NULLS LAST LIMIT 1` — the data-science page shipped with **4,357 kW** as "ALL-TIME PEAK POWER" (`datascience.html:52`), above the 4,245 kW nameplate and the 4,200 kW grid cap (DATA_DICTIONARY §8 says 4,200 is the normal ceiling). A public "record" that exceeds the machine's rating invites exactly the question you don't want.
BETTER
```sql
WHERE active_power_max BETWEEN 0 AND 4245 * 1.05          -- or ask ACE what the true max is
ORDER BY active_power_max DESC LIMIT 1
```

**DB-07 · MEDIUM · The "manufacturer" power curve is hand-typed and the constants disagree** (`:193-229`)
Labelled "Enercon E-115 EP3 4.2MW manufacturer reference curve" but no source is cited; the fallback in `datascience.js:41-47` is a different function (`frac^2.6`). Rated is 4200 here (`:221`), 4245 in `constants.js:11`; cut-out is 25 m/s here (`:224`), 28/34 in `constants.js:16-17`, "28–34" in DATA_DICTIONARY; `SYSTEM_DESIGN.md:309` uses 3500 kW for capacity factor.
BETTER: one `FACTS` object (`constants.js`) with `value, source, checkedOn, verifiedBy`; relabel any curve "indicative shape" unless you have the Enercon datasheet.

**DB-08 · MEDIUM · Magic dates and months baked into SQL** (`:303, :312`)
`'2026-08-01'…'2026-09-01'` and keys `august_2026/september_2026` (`aiAgent.js:192`). In October these are stale; by November the "monthly comparison" is a historical curiosity labelled as a trend. BETTER: compute `date_trunc('month', now())` and the previous month, or delete.

---

### 2.6 `server/redisClient.js`

**RIGHT**: in-memory fallback if Redis is unavailable (`:9-10`, `:65-80`), so Redis is never a hard dependency. `lazyConnect` + caught initial failure is correct.

**WRONG**

**RD-01 · MEDIUM · Rate limiter is not atomic**
CURRENT `:49-51`
```js
const count = await redis.incr(key);
if (count === 1) { await redis.expire(key, windowSec); }
```
If the process dies between the two calls the key never expires and that session is blocked forever. BETTER: `await redis.set(key, 0, "EX", windowSec, "NX"); const count = await redis.incr(key);` (or one Lua script). Doc claims "sliding window … atomic Lua"; this is a fixed window and not atomic.

**RD-02 · MEDIUM · Memory fallback grows without bound** (`:9-10`)
`memorySessions` / `memoryRateLimits` are only cleaned when the *same* key is seen again. Combined with SRV-06 (client-chosen keys) an attacker, or a bot, can grow them until the kiosk host OOMs. BETTER: `setInterval(() => { const now = Date.now(); for (const [k, v] of memoryRateLimits) if (v.expiresAt < now) memoryRateLimits.delete(k); /* same for sessions */ }, 60_000).unref();`

**RD-03 · LOW · Log spam when Redis is absent** (`:27-30`; observed every ~3 s in E2). BETTER: log the first error and then once per hour.

**RD-04 · MEDIUM · Redis does nothing the app needs.** Its three uses (rate limit, 8-message chat history, a 10-s copy of the live state that `getState()` already holds in memory) all disappear with the chat (D4). BETTER: remove the container and the `ioredis` dependency.

---

### 2.7 `server/aiAgent.js` and `server/ragKnowledge.js` ("Ask the Turbine")

**RIGHT**: tool boundary with fixed functions rather than LLM-written SQL (`:13-98`) is the correct security instinct; typo-tolerant intent regexes and a local fallback when no API key exists are thoughtful.

**WRONG**

**AI-01 · HIGH · Hard-coded facts presented as verified, live data** (`aiAgent.js:182-186`)
CURRENT
```js
return `Here are my verified all-time records across my first 78 days of operation:\n\n` +
  `⚡ **Peak Power Output:** **${…} kW** (~4.36 MW) recorded on 30 September!\n` +
  `🌪️ **Maximum Wind Gust:** **${…} m/s** (~79.5 km/h) recorded on 4 September!\n` +
```
"78 days", "4.36 MW", "30 September", "4 September", "79.5 km/h" are snapshots from the author's machine today. They will be wrong tomorrow, and "first 78 days of operation" is untrue (operating since March 2023). BETTER: format from the returned row (`rec.peak_power.timestamp`, `rec.peak_wind.timestamp`) or delete the feature (§5.3).

**AI-02 · HIGH · Fabricated defaults, sign bug, and three different "homes" constants** (`:21, :31, :168-169, :175, :186, :192`)
`ds.avgWs || "4.5"` and `ds.capacity_factor_pct || "28.5"` invent values when the query returns nothing; `+${delta}%` prints `+-12.3%` when September is *lower*; homes use `/ 0.9` kW (`:21,:31`), `/ 8.2` kWh/day (`:175`) and `homes_powered_estimate` (`timescaleDb.js:166`) which is labelled "for a full year" (`:186`) but is an average over the data window (off by `days/365`). The community page uses `/ 0.35`. Same turbine, four homes counts.
BETTER: one helper `homesFor(kWh, hours)` in `metrics.js`; never default a missing number; `const sign = d > 0 ? "+" : d < 0 ? "−" : ""`.

**AI-03 · MEDIUM · Unbounded external calls and fictional model IDs** (`:244-263`)
`fetch` without a timeout (a stalled Gemini call holds the visitor's request open), four candidate models tried *sequentially per request* including `"gemini-3.8-flash"`, API key in the URL query string (appears in proxies' logs), "streaming" is a single `onToken(text)`. BETTER: `signal: AbortSignal.timeout(8000)`, one configured model name from env, key in `x-goog-api-key` header.

**AI-04 · HIGH · The "knowledge base" is your own planning docs, including invented facts** (`ragKnowledge.js:9-18`, `:140`)
The index includes `README.md`, `SYSTEM_DESIGN.md`, `PUBLIC_EXPERIENCE_BLUEPRINT.md` (which contains made-up statements, DOC-04) and `exploratory analysis.md`. Answers are literally *"From our project technical documentation (README.md in …)"* (`aiAgent.js:206`). A resident asking about grid curtailment gets markdown from a developer README.
BETTER: delete; if a Q&A is wanted, ship ~8 curated Q&A strings reviewed by ACE (see §4/D4).

**AI-05 · HIGH · XSS in the chat widget** (`chat-widget.js:128, 160-168`)
`assistantBubble.innerHTML = formatMarkdown(data.answer)` with no escaping; the answer includes LLM output and RAG excerpts. Prompt-inject a model into emitting `<img src=x onerror=…>` and it executes on a public screen. BETTER: `const safe = escapeHtml(text)` *before* the `**`→`<strong>` replacements, or use `textContent`.

**AI-06 · MEDIUM · A free-text chatbot on an unattended public screen** is a moderation and credibility risk (people type abuse, the bot is "the turbine" and answers in the community's voice), cannot be used without a keyboard, and is the weakest part of a 3-minute pitch because it depends on a third-party API's mood. See §4/D4.

---

### 2.8 `server/datasetService.js` (email-gated dataset downloads)

**RIGHT**: HMAC signing with `timingSafeEqual` is the right primitive; fixed dataset map prevents path traversal.

**WRONG**

**DS-01 · HIGH · Committed default signing secret** (`:8`)
```js
const SECRET_KEY = process.env.DATASET_SECRET_KEY || "ace-wind-dataset-secret-token-key-2026";
```
Anyone reading the (public, open-source) repo can mint valid tokens for any deployment that forgot the env var. Same pattern: DB password `ace_password` in `docker-compose.yml:10`, `timescaleDb.js:9`, `ingest_zenodo_timescale.py:11`.
BETTER: `const SECRET_KEY = process.env.DATASET_SECRET_KEY; if (!SECRET_KEY) throw new Error("DATASET_SECRET_KEY required");` plus a `.env.example`.

**DS-02 · HIGH · Open email relay with HTML injection** (`:140-150`, `server.js:197`)
`/api/datasets/request` takes any `email` and unescaped `name`, and sends HTML from `datasets@acewind.org` via Resend: `name = "<a href=https://evil>Click</a>"`, `email = victim@…` = phishing from your domain, with no rate limit and no CAPTCHA.
BETTER: delete the feature (DS-04). If kept: escape `name`, limit per IP, and never send to an unverified address.

**DS-03 · MEDIUM · The "email" step is theatre** — `requestDatasetDownload` *returns the link to the requester* (`:113`, `server.js:208`), so the token protects nothing and the link is `http://` (`:113`) even behind TLS.

**DS-04 · MEDIUM · Gating CC-BY open data contradicts the project's purpose.** The files are already free on Zenodo (DOI 10.5281/zenodo.22662372), and the repo does not contain them (`data/` and `*.parquet` ignored), so the feature cannot work on a fresh clone either. BETTER: a QR + DOI on the screen's footer; delete `datasetService.js`, `dataset_downloads`, the modal, and the Resend dependency.

---

## Step 2 (continued) — File-by-file review (browser side)

### 2.9 `public/js/constants.js`

**RIGHT**
- Everything physical or financial lives in one file shared by server and browser, and the comments say which values are *ASSUMPTION* and that the UI "always labels it estimated" (`:23-28`). That honesty culture is the right instinct; extend it (CO-04).
- Attribution text and licence URL are constants, so the footer can never drift from the CC-BY requirement.

**WRONG**

**CO-01 · HIGH · The "homes powered" yardstick is defensible mathematically but indefensible as worded** (`:21`)
`AVG_UK_HOME_DEMAND_KW = 0.35` ⇒ 4,200 kW → **12,000 homes**; my test run (3.1 MW) printed **~8,857**. Your own docs say the turbine powers "~3,500–4,000 homes" per year (`DATA_DICTIONARY.md:202`) and `exploratory analysis.md:40` expects "up to ~4,000 icons". The screen copy says *"lit up across Lawrence Weston right now"* and *"Every single house in that count is running on 100 % clean wind"* (`stories-community.js:76-79`). A ward of a few thousand households cannot contain 12,000, and grid-connected homes are not "running on" this turbine. Residents and ACE staff know both numbers. (Constants also disagree across files: 0.35 kW in `metrics.js`, 0.9 kW in `aiAgent.js:21,31` and `SYSTEM_DESIGN.md:442`, 8.2 kWh/day in `aiAgent.js:175`, 2,900 kWh/yr in `timescaleDb.js:166`.)

CURRENT `constants.js:21`, `metrics.js:13-16`, `stories-community.js:76-79`
```js
export const AVG_UK_HOME_DEMAND_KW = 0.35;
export function homesPoweredNow(kw) { ...; return Math.round(kw / AVG_UK_HOME_DEMAND_KW); }
headline: `Lighting Up ${n} Local Homes Right Now`,  stat: `${n} Homes`,  statUnit: `lit up across Lawrence Weston right now`
```
BETTER — one yardstick, stated, and phrased as *equivalence*, with the stable "per day" form as the hero
```js
// constants.js
export const FACTS = {
  homeKwhPerDay: { value: 8.2, source: "Ofgem typical medium household ≈ 2,700 kWh/yr (check current TDCV)", checkedOn: "2026-10-07" },
};
// metrics.js
export const homesForToday = (kwh) => Number.isFinite(kwh) ? Math.round(kwh / FACTS.homeKwhPerDay.value) : null;
export const homesEquivalentNow = (kw) => Number.isFinite(kw) ? Math.round(kw * 24 / FACTS.homeKwhPerDay.value) : null;
// copy
`Right now the turbine is making as much electricity as ${n} homes typically use.`
`Today it has made enough for ${homesForToday(kwh)} homes for a day.`   // stable, quotable, reconcilable with ACE's own "~3,xxx homes a year"
```
*Why:* the equivalence wording is true; the "today" form is stable through the day and lines up with ACE's published annual figure. If you obtain the ONS household count for Lawrence Weston, "x % of every home in Lawrence Weston" is a much stronger community line. (Ask ACE which yardstick *they* publish and use theirs.)

**CO-02 · HIGH · The community-fund rate is invented, and the screen presents it as money raised** (`:28`)
`COMMUNITY_FUND_RATE_GBP_PER_MWH = 5` is an `ASSUMPTION` with a comment saying "confirm with ACE", yet `stories-community.js:106` says *"Today's wind has already raised an estimated £62 directly for the Ambition Lawrence Weston fund — paying for emergency heating vouchers"* (I saw exactly "£62 Raised" in E8), and `:113` converts that to "Heat Vouchers" at an invented £30 each. A made-up money figure about a charity is the single most damaging thing the screen can say if it is wrong.
BETTER: delete the live £ calculation. Replace with a **static, sourced fact from ACE** ("Since 2023 ACE has returned £X to Lawrence Weston — source/date") or no £ at all. If ACE gives a real £/MWh, add it to `FACTS` with `source` and keep the label "estimate".

**CO-03 · MEDIUM · Cut-out thresholds are a guess presented as a rule**
`CUT_OUT_LOW_MS = 28`, `CUT_OUT_HIGH_MS = 34` (`:16-17`) vs 25 m/s in `timescaleDb.js:224`. Enercon turbines ramp power down in a storm-control band rather than snapping off at one speed. `turbine-mood.js:22` then declares **"storm: blades turned to stay safe"** at ≥ 28 m/s even when the rotor is still turning and generating. BETTER: decide "storm" from what the turbine *is doing* (rpm/power/status) plus wind (MD-01), not from a speed alone.

**CO-04 · LOW · No provenance per constant.** BETTER: the `FACTS` object above (`value, source, checkedOn`) and render a "Facts & sources" page/QR. Also state the CO₂ factor's *vintage* (`:22`, "0.207 kg/kWh": which year, which publication; use the latest published UK grid factor and say so on screen).

---

### 2.10 `public/js/metrics.js`

**RIGHT**
- Pure functions with explicit units; trivially unit-testable (and untested: INF-07).
- **Tip speed is correct** (`tipSpeedMs`: rpm·2π·r/60 with D = 115.7 m ⇒ 13.5 rpm = 81.8 m/s = 183 mph, matching "up to ~180 mph").
- **Beaufort thresholds are the correct m/s bands** (`:50-61`).

**WRONG**

**ME-01 · MEDIUM · Missing data silently becomes zero** (`:13-31`)
`homesPoweredNow(null)`, `co2AvoidedKg(undefined)` return `0` (`metrics.js:13-31`). The UI cannot tell "0 homes" from "unknown". CURRENT `if (typeof kw !== "number" || kw <= 0) return 0;` BETTER `if (!Number.isFinite(kw)) return null; return Math.max(0, kw) …` and callers skip `null`.

**ME-02 · MEDIUM · Beaufort labels describe hub-height wind as if it were street-level weather** (`:50-61`, used by `windMoodStory`)
Beaufort is defined for 10 m; the anemometer is at the nacelle (~92 m) where wind is stronger. "A *Fresh breeze* sweeping across the Severn" while residents outside feel a light breeze is a small but visible mismatch. BETTER: label it where it is measured: *"Wind at the turbine (92 m up): 9 m/s, a fresh breeze"*, and/or show a plain-English "what you'd feel on the ground" only if you apply a stated shear factor.

**ME-03 · LOW · Trees metric mixes units** (`:23-26`, `CO2_KG_PER_TREE_PER_YEAR = 21`)
A tree absorbs ~21 kg *per year*; copy says "122 trees worth of clean air generated so far today". BETTER: *"the same CO₂ that 122 trees absorb in a whole year"*, and keep `CO₂` rather than "choking smoke" (SC-03).

---

### 2.11 `public/js/ws-client.js`

**RIGHT**: auto-reconnect with `error → close`; `isStale()` is exactly the right idea; small, dependency-free.

**WRONG**

**WS-01 · HIGH · No watchdog, `isStale()` is never called, reconnect has no back-off** (verified E8)
A silently dead TCP connection (router reboot, Wi-Fi roam) can leave a browser WebSocket "open" for a long time; the page shows the last story forever. Server restarts also cause all screens to reconnect at the same instant every 2 s.
CURRENT `ws-client.js:29-31, 43-45`
```js
socket.addEventListener("close", () => { setTimeout(connect, RECONNECT_DELAY_MS); });
export function isStale() { return lastMessageAt === 0 || Date.now() - lastMessageAt > STALE_AFTER_MS; }
```
BETTER
```js
let tries = 0, last = null;
socket.addEventListener("open",    () => { tries = 0; });
socket.addEventListener("message", (e) => { lastMessageAt = Date.now(); last = JSON.parse(e.data); /* …notify… */ });
socket.addEventListener("close",   () => setTimeout(connect, Math.min(30_000, 1000 * 2 ** tries++) * (0.75 + Math.random() / 2)));

// the server heartbeats every second (ST-01); 10 s of silence ⇒ the pipe is dead, whatever the browser thinks
setInterval(() => { if (Date.now() - lastMessageAt > 10_000) try { socket.close(); } catch {} }, 5_000);

// one source of truth for the on-screen chip: server freshness, overridden by transport health
export const freshness = () => (isStale() ? "offline" : last?.freshness ?? "connecting");

// belt and braces for weeks of uptime: reload at 03:30 local, and when the server build id changes
setInterval(() => { const d = new Date(); if (d.getHours() === 3 && d.getMinutes() === 30) location.reload(); }, 60_000);
```
*Why:* converts every network/browser pathology into the same visible `OFFLINE` state, then self-heals.

---

### 2.12 `public/js/turbine-mood.js`

**RIGHT**: one classifier shared by all three personas (`community`, `schools`, `datascience`) with a plain-English map (`COMMUNITY_MOOD_TEXT`). Clean and extendable.

**WRONG**

**MD-01 · MEDIUM · "storm" is inferred from wind speed alone; "fault/maintenance" texts claim things the data cannot know**
CURRENT `:22` `if (windSpeed >= CUT_OUT_LOW_MS) return "storm";` and `COMMUNITY_MOOD_TEXT.fault = "Stopped for safety - engineers notified"`, `stories-community.js:26` "Local engineers have already received the call". A fault flag does not tell you who was notified; a wind speed does not tell you the blades are feathered.
BETTER (observable facts only; "unknown ⇒ say so")
```js
export function classifyMood(s) {
  if (!s?.now || ["offline", "connecting"].includes(s.freshness)) return "offline";
  const { windSpeed: w, activePowerKw: p, rotorRpm: rpm } = s.now, st = s.statusEvent ?? {};
  if (st.fault_message_flag) return "fault";                 // "Paused for a safety check"
  if (st.service_flag)       return "maintenance";           // "Being serviced"
  if ([w, p, rpm].some((x) => x == null)) return "delayed";
  if (rpm < 0.5 && p <= 10)  return w < CUT_IN_WIND_MS ? "calm" : "paused"; // "Not generating right now"
  if (isCurtailed(s.now))    return "curtailed";
  return p > 50 ? "generating" : "idling";
}
```
*Why:* each branch is something the screen can truthfully state; "paused despite wind" is shown as exactly that instead of an invented reason.

**MD-02 · LOW · `main_status === 1/2` codes drive "curtailed"/"starting"** — see ST-08 (unverified code table).

---

### 2.13 `public/js/hotkey-nav.js`, `story-rotator.js`, `turbine-anim.js`

**RIGHT**: `turbine-anim.js` (frame-rate-independent easing, `dtSec` clamp) and `story-rotator.js` (no immediate repeat) are small and correct.

**WRONG**

**NAV-01 · MEDIUM · Dev navigation is visible and live on the public screen** (observed in E7: the hot-nav pill overlaps the background-switcher pill at top-right)
CURRENT `hotkey-nav.js:20,37`; `base.css:92-100` (`opacity: 0.18` permanent)
```js
} else if (e.key === "a" || e.key === "A" || e.key === "0") { location.href = "admin.html"; }
<a href="admin.html" …>A: Admin Portal</a>
```
A visitor, cleaner or child with a keyboard/mouse on the kiosk can reach the admin page; the pill is a ghost of UI over a billboard.
BETTER
```js
export function initNav({ current }) {
  if (!new URLSearchParams(location.search).has("dev")) return;   // kiosk URL has no ?dev ⇒ no nav, no hotkeys
  …
}
```

---

### 2.14 `public/community.html` + `public/js/community.js` + `public/css/community.css` — **the product**

**RIGHT**
- The *idea* is right: one large human-readable card + one large turbine, soft palette, lots of whitespace. At a glance (see screenshot E7) it looks calm and "premium".
- Story rotation at 8 s with a short cross-fade is the right cadence for ambient viewing; text is set with `textContent` (no injection).
- The status pill's plain-English mapping (`community.js:97-108`) is the right pattern.
- Semantic extras are good: `aria-label`s on photo layers, `lang="en"`, viewport meta.
- Responsive clamp() for headline/stat sizes (`community.css:204,235`) is the right technique, just not applied everywhere.

**WRONG**

**CM-01 · BLOCKER · Placeholder/fiction is what the first 8.5 seconds show** (verified E7)
CURRENT `community.html:66`, `community.js:195-212`
```html
<span class="human-stat-number" id="story-stat-number">2,840 Homes</span>
```
```js
setTimeout(() => { renderCurrentStory(); setInterval(renderCurrentStory, ROTATION_INTERVAL_MS); }, 500);
// at 500 ms the WebSocket has usually not delivered a state, getAvailableStories() returns [] (`if (!latestState) return []`), nothing renders, and the next try is 8 s later.
```
At 4.5 s the headline says "2,840 Homes lit up" while the pill says "~8,857 local homes". If the backend is down at boot, the placeholder stays for ever. This is also the *first thing a judge sees* on a cold start.
BETTER
```html
<span class="human-stat-number" id="story-stat-number">…</span>
<span class="human-stat-context" id="story-stat-context">Connecting to the turbine</span>
```
```js
let started = false;
onState((s) => {
  latestState = s;
  document.body.dataset.freshness = freshness();           // drives chip/banner (CM-03)
  if (!started && s.now) { started = true; renderCurrentStory(); setInterval(renderCurrentStory, ROTATION_INTERVAL_MS); }
});
```
*Why:* the first paint is either honest ("Connecting…") or real; a number only appears once it came from the turbine.

**CM-02 · BLOCKER · Today's energy (and every figure derived from it) is invented when unknown** (`community.js:125`; same pattern `schools.js:205`)
CURRENT
```js
const todayKwh = today.energyKwh || Math.max(250, Math.round(Math.max(10, powerKw) * 4));
const co2Kg = co2AvoidedKg(todayKwh);  const trees = Math.round(treesEquivalent(co2Kg));  const fundGbp = Math.round(communityFundGbp(todayKwh));
```
`0 || …` also fires on a legitimate `0`, and just after midnight `today.energyKwh` is `undefined` (ST-05), so the screen says "Trees worth of clean air generated so far today" using `power × 4`. CO₂, trees and £ then inherit the fiction.
BETTER
```js
const todayKwh = Number.isFinite(today?.energyKwh) ? today.energyKwh : null;
const beats = [
  liveBeat(now),
  todayKwh != null && todayBeat(todayKwh),                 // skipped, not faked, when unknown
  todayKwh != null && cleanAirBeat(co2AvoidedKg(todayKwh)),
  sinceBeat(now.lifetimeEnergyKwh),
  windBeat(now), prideBeat(), recordBeat(historicalRecords),
].filter(Boolean);
```
*Why:* an absent beat costs nothing; an invented number costs the whole screen its credibility.

**CM-03 · HIGH · No visible LIVE / DELAYED / OFFLINE / DEMO state at all** (verified E8)
`snapshot.mode` only changes the *colour of a 9 px dot* (`community.js:83-84`); `snapshot.connected` and `isStale()` are never read; the stories keep rotating.
BETTER
```html
<div id="live-chip" class="live-chip" role="status" aria-live="polite"><i class="dot"></i><span id="live-chip-text">Connecting…</span></div>
```
```js
const CHIP = {
  live:       () => "LIVE · updated just now",
  delayed:    (s) => `DELAYED · last reading ${Math.round(s.ageSec / 60)} min ago`,
  offline:    () => `OFFLINE · showing the last reading from ${lastGoodTime}`,
  demo:       () => "DEMO DATA · not live",
  connecting: () => "Connecting…",
};
```
```css
.live-chip{position:fixed;top:2.2vh;right:4.5vw;font-size:var(--fs-label);padding:.4em .9em;border-radius:999px}
body[data-freshness="live"]    .live-chip{background:#065f46;color:#fff}
body[data-freshness="delayed"] .live-chip{background:#b45309;color:#fff}
body[data-freshness="offline"] .live-chip,
body[data-freshness="demo"]    .live-chip{background:#7f1d1d;color:#fff}
body[data-freshness="offline"] .community-hero-card{filter:grayscale(1);opacity:.7}   /* can't be mistaken for live */
```
*Why:* the minimum requirement says "uses live data from the ACE API"; the screen must be able to *prove* it is, and admit when it isn't. It is also the single most persuasive thing you can show judges on the "robustness" criterion (pull the network cable live).

**CM-04 · HIGH · A hard-coded date and a mislabelled lifetime figure inside "live" copy** (`community.js:161, 164`)
CURRENT
```js
lead: `On 18 September, our turbine generated an astounding ${…} kWh … setting our all-time community benchmark!`,
pride: `Over ${(totals.total_energy_kwh / 1_000_000).toFixed(2)} GWh of clean energy produced so far for Lawrence Weston.`
```
The date is typed in; tomorrow's record will still say 18 September. "so far" is 1.77 GWh (78 days of DB rows) when the turbine's lifetime output is of the order of 30+ GWh (the app's own default is 34.5 GWh, `DATA_SOURCES.md:97` says 30.6 GWh; the live `wec_energy_exported` meter is the authority), understating the community's own achievement by ~20×.
BETTER
```js
const when = new Date(bestDay.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
lead: `On ${when} the turbine generated ${fmtInt(bestDay.energy_kwh)} kWh in a single day — our best day on record.`,
pride: now.lifetimeEnergyKwh != null ? `${(now.lifetimeEnergyKwh / 1e6).toFixed(1)} GWh of clean electricity since 2023.` : "",
```

**CM-05 · MEDIUM · Yaw never reaches the 3D model (field-name mismatch)** (`community.js:94`)
CURRENT `turbine.setTelemetry({ rotorRpm, nacelleYaw: now.nacelleAzimuthDeg });` — the state field is `nacelleDeg` (`state.js:87`), so `nacelleYaw` is always `undefined`. BETTER `nacelleYaw: now.nacelleDeg`, but see TH-03 before enabling it.

**CM-06 · HIGH · Most text is unreadable from 3 m** (measured in E7)
Assumptions: 55″ 16:9 1080p ⇒ 0.63 mm/pixel; cap-height ≈ 0.72 × font-size ⇒ 0.46 mm per CSS px. Common signage rule of thumb: ~25 mm letter height per 3 m for comfortable reading, roughly 10–12 mm as the floor.

| Element (CSS line) | px @1080p | cap height | Verdict |
|---|---|---|---|
| `.story-headline` (`community.css:204`) | 62 | 28 mm | OK |
| `.human-stat-number` (`:235`) | 61 | 28 mm | OK |
| `.story-lead` (`:214`) | 24 | 11 mm | marginal |
| `.human-stat-context` (`:242`) | 18 | 8 mm | **too small**: it carries the unit ("homes lit up…") |
| `.peaceful-status-pill` (`:288`) | 14 | 6 mm | **unreadable**: the only live-status sentence |
| `.pride-motto` (`:271`) | 15 | 7 mm | unreadable |
| `.footnote`, `.kicker` (`:386`, `:190`) | 13 | 6 mm | unreadable (by design a footnote, but it holds the CC-BY credit) |

And everything in `rem` is half the physical size on a 4K TV at 100 % scaling.
BETTER
```css
html { font-size: clamp(16px, 0.8333vw, 44px); }          /* 1rem = 16 px at 1920 wide, 32 px at 3840 */
:root {
  --fs-hero:  clamp(6rem, 9vw, 11rem);                    /* "3.1 MW" */
  --fs-title: clamp(3rem, 4.6vw, 5rem);
  --fs-body:  clamp(1.9rem, 2.3vw, 2.6rem);               /* ≥ 36 px at 1080p */
  --fs-label: clamp(1.5rem, 1.8vw, 2rem);                 /* ≥ 29 px; nothing on screen below this */
}
.story-lead { font-size: var(--fs-body); }
.human-stat-context, .peaceful-status-pill, .pride-motto, .footnote, .story-kicker-pill { font-size: var(--fs-label); }
```
*Why:* sizes scale with the screen, the live sentence and units become readable, and the attribution can stay small but not microscopic (keep ≥ 22 px).

**CM-07 · MEDIUM · Debug/dev UI on a screen nobody can touch** (observed E7)
Visible: "Lush Hillside / Avonmouth Drone Site" toggle (`community.html:35-44`), *"Drag 3D model to rotate · Press 'B' to change background"* (`:104`), *"Interactive 3D Enercon E-115 · Drag to Orbit"* (`:89`), the "Ask the Turbine" button (overlaps the footer text, observed), the ghost hot-nav pill. All are instructions for a mouse that the kiosk does not have.
BETTER: remove them from the kiosk build (render only when `?dev`), use the freed space for CM-06. The README sells "Interactive orbit" (`README.md:20`); on a public wall it is dead weight (D12).

**CM-08 · MEDIUM · Story rotation skips/repeats and the screen has no always-on live number**
`getAvailableStories()` returns a *different-length array on every tick* (mood beat inserted/removed, record beat added after fetch) but `currentStoryIndex % stories.length` indexes into it, so beats are skipped or doubled. And the only live-power information is inside a rotating card; at any moment a visitor may see "Pride" or "Clean air" with no indication of what the turbine is doing now.
BETTER: (a) a fixed ordered list of beat builders, skipping `null`:
```js
let i = 0;
function nextBeat(ctx) { for (let n = 0; n < BEATS.length; n++) { const b = BEATS[i++ % BEATS.length](ctx); if (b) return b; } }
```
(b) A **pinned "Now" strip** that never rotates: `3.1 MW · 74 % of full power · wind 9 m/s`, and a pinned "Today / Since 2023" pair. See §3.3 for the layout.

**CM-09 · HIGH · The default background is the Windows XP "Bliss" photograph, with a wallpaper-site watermark** (`community.css:41`, E12)
It is instantly recognisable, copyrighted (Microsoft-owned photograph), watermarked in the bottom-right corner, and associates a community's pride project with a decades-old Windows wallpaper. The README calls it a "lush rolling green meadow".
CURRENT `community.css:40-43`
```css
.photo-green-hills { background-image: url('../img/green-hills.jpg'); background-position: center 48%; }
```
BETTER (see also CM-11 for the live sky)
```css
.sky { background: linear-gradient(to bottom, var(--sky-top) 0%, var(--sky-bottom) 58%, var(--hill-far) 58%, var(--hill-near) 100%); }
:root { --sky-top:#2b6cb0; --sky-bottom:#cfe8ff; --hill-far:#4c8a3e; --hill-near:#2f5f2a; }
```
or a photograph you may legally use (ACE's own; CC0 with an `ATTRIBUTION.md` entry). *Why:* removes a licence risk and a laugh from the room.

**CM-10 · MEDIUM · Photo mode shows two turbines; backgrounds are low-resolution**
In "Avonmouth Drone Site" mode a real turbine is in the photograph *and* the 3D one is rendered in front (E7 layout: the photo's turbine sits mid-left, the model right). Both background JPEGs are small (`ace-real-drone.jpg` 1024×628, `green-hills.jpg` 1024×576) and are `background-size: cover` upscaled ×1.9 on 1080p, ×3.75 on 4K: visibly soft. Provenance/permission for the drone photo is unstated (INF-04).
BETTER: use the drone photo only as a full-bleed *intro/interstitial scene* (no 3D model), at ≥ 1920 px, with credit; or drop the toggle.

**CM-11 · MEDIUM · Daylight is hard-coded; the real sky never appears**
Lighting is always bright afternoon (`three-turbine.js:96-125`), copy says "still afternoon" at any hour (`stories-community.js:53`). At 9 pm the community centre sees a midday photo. The blueprint promises "a sky that matches the real outside weather" (`PUBLIC_EXPERIENCE_BLUEPRINT.md:61`) and this is the cheapest *real live-data* wow you can add: `wecstd` already publishes `ambient_brightness_mean` (lux), `precipitation_mean`, `visibility_mean` and hub-height `air_temperature_mean` (10-min resolution; verify availability and units on the live family before relying on them). Even without them, a simple sun-elevation calculation for 51.54°N, −2.67°E gives dawn/day/dusk/night.
BETTER
```js
// every 60 s: choose a sky palette from sun elevation (or lux, if available) and set CSS variables + the three.js light colour
const elev = sunElevationDeg(new Date(), 51.5379, -2.6740);   // ~15-line NOAA formula
const t = Math.min(1, Math.max(0, (elev + 6) / 12));            // 0 = night, 1 = day
document.documentElement.style.setProperty("--sky-top", mix("#0b1026", "#2b6cb0", t));
sun.intensity = 2.4 * t + 0.15; hemi.intensity = 1.1 * t + 0.25;
```
*Why:* memorable, truthful, and it makes the low-wind/night states look intentional rather than broken.

**CM-12 · MEDIUM · Compositor/GPU cost from stacked blur filters** (to be measured, §3.6)
Six `backdrop-filter: blur()` layers (`community.css:78,100,167,283,354,389`, 12-28 px radii, one with `saturate(180%)`) over an animating scene, plus `filter: drop-shadow(0 15px 35px …)` on the WebGL container (`:333`). A CSS filter on a canvas that redraws 60×/s forces a full re-raster per frame; `will-change` on the photo layers (`:31`) pins two full-screen compositor layers permanently.
CURRENT `community.css:167, 333`
```css
backdrop-filter: blur(28px) saturate(180%);
filter: drop-shadow(0 15px 35px rgba(15, 23, 42, 0.18));
```
BETTER
```css
.community-hero-card { background: rgba(255,255,255,.94); }   /* no live blur; nothing moves behind it anyway */
.three-turbine-container { filter: none; }                     /* the ShadowMaterial disc already grounds the model */
.photo-layer { will-change: auto; }
```
*Why:* identical look at 94 % opacity, a fraction of the GPU work. Measure before/after on the real PC (Chrome DevTools → Performance → GPU, or `chrome://gpu` + Task Manager GPU %).

---

### 2.15 `public/js/three-turbine.js` (3D turbine)

**RIGHT**
- **Honest motion**: rotor angular speed = real RPM (`three-turbine.js:255-256`: `rpm·2π/60 · dt`); easing makes it look heavy, not toy-like. At ≤ 13.5 rpm (1.35°/frame at 60 fps) there is no wagon-wheel aliasing. This is the best "live data you can see" on the screen.
- The GLB is lean and correct: 1.1 MB, ~40 k triangles, **no textures**, a sensible hierarchy (`Yaw → RotorTilt → RotorSpin`), real scale (hub ≈ 92 m, tip ≈ 150 m, E10).
- `dt` clamped to 0.1 s so a throttled tab doesn't spin the rotor by minutes of angle.
- `onResize` guards zero sizes; `ShadowMaterial` disc is a cheap way to ground the model.
- Beacon pulse (`:269-270`) is a nice detail.

**WRONG**

**TH-01 · MEDIUM · Settings are tuned for a gaming GPU, not a modest kiosk** (`:44-54, 108-110`; console warning seen in E7)
`antialias:true`, `setPixelRatio(min(dpr,2))`, a 2048² soft shadow map, always 60 fps, `powerPreference:"high-performance"`. And `THREE.PCFSoftShadowMap` **no longer exists in the three r18x you ship**: the console prints *"PCFSoftShadowMap has been removed. Using PCFShadowMap instead."*
BETTER
```js
this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });       // let the TV's scaler do the smoothing
this.renderer.setPixelRatio(1);                                                    // a 40-m-wide object doesn't need 4K pixels
this.renderer.shadowMap.type = THREE.PCFShadowMap;
sunLight.shadow.mapSize.set(1024, 1024);

const FRAME_MS = 1000 / 30; let acc = 0;                                           // 30 fps is indistinguishable at 13 rpm
const animate = (t) => {
  this._raf = requestAnimationFrame(animate);
  acc += t - (this._prev ?? t); this._prev = t;
  if (acc < FRAME_MS) return; const dt = Math.min(0.1, acc / 1000); acc = 0;
  this.update(dt, t); this.render();
};
```
*Why:* ~4× less GPU work for no visible loss; fits integrated graphics and a fanless mini-PC.

**TH-02 · HIGH · No WebGL context-loss recovery, no scheduled reload** (`:36-58`)
Long-running Chromium on integrated GPUs loses the context after driver resets, sleep/wake, or display changes; the canvas then stays black until a human reloads. There is no `webglcontextlost` handler.
BETTER
```js
const cv = this.renderer.domElement;
cv.addEventListener("webglcontextlost",     (e) => { e.preventDefault(); this.stop(); this._lostAt = Date.now(); });
cv.addEventListener("webglcontextrestored", () => { this.start(); });
setInterval(() => { if (this._lostAt && Date.now() - this._lostAt > 30_000) location.reload(); }, 10_000);
```
(+ the nightly reload from WS-01.)

**TH-03 · MEDIUM · Yaw interpolation spins the long way round, and absolute heading fights the fixed camera** (`:262-264`)
CURRENT
```js
const diff = this.targetYawDeg - this.displayedYawDeg;
this.displayedYawDeg += diff * Math.min(1, dt * 0.4);
this.yawNode.rotation.y = THREE.MathUtils.degToRad(this.displayedYawDeg);
```
Heading 350° → 10° rotates the nacelle 340° backwards. Also the model's local axes are not compass-aligned with the camera, so enabling real yaw (CM-05) can turn the rotor face away from the viewer. For a *public hero shot* the 3D view should stay composed.
BETTER
```js
const diff = ((((this.targetYawDeg - this.displayedYawDeg) % 360) + 540) % 360) - 180;   // shortest arc
```
and either leave the model facing a good 3/4 angle (ignore yaw) or show wind direction as streaks/arrow rather than turning the machine. *Why:* a gorgeous camera angle is worth more than a technically exact heading nobody can read.

**TH-04 · LOW · Orbit/zoom controls on a non-interactive screen** (`:64-72`)
If a child touches or a stray mouse wheel hits the TV's PC, the framing is lost until a double-click that nobody knows about. BETTER: `controls.enabled = DEV;` and a slow automatic camera drift (`±4°` over 60 s) for parallax, which *is* visible from the back of the room.

**TH-05 · LOW · Default framing clips the vertical blade tip** (observed in E7: the upper blade runs into the top navigation pills). BETTER: `PerspectiveCamera(42, …)` or move `defaultCamPos` ~12 % back; confirm at 16:9 and 21:9.

---

### 2.16 `public/js/stories-community.js` (copy)

**RIGHT**
- **Voice**: warm, plain English, zero jargon, no kW/kWh on the card. The tone is exactly right for the audience.
- `moodStory` per state is the right structure: every condition (calm, curtailed, fault…) has a human sentence.
- Variant picking avoids a robotic loop.

**WRONG**

**SC-01 · HIGH · "Floors" turn zero or unknown into a good-news number** (`:73, 101-102, 130`)
CURRENT
```js
const safeHomes = Math.max(1, Math.round(homes));
const safeFund  = Math.max(15, Math.round(fundGbp));      // "£15 raised" even when nothing was generated
const safeTrees = Math.max(25, Math.round(treesCount));   // "25 trees" at midnight in a dead calm
```
BETTER
```js
export function todayBeat(kwh) { if (!Number.isFinite(kwh) || kwh <= 0) return null; … }   // no beat is better than a false beat
```

**SC-02 · HIGH · The money story** — see CO-02. Delete `fuelPovertyStory` as written, or rebuild it as a *static* ACE-sourced fact.

**SC-03 · HIGH · Overclaims and wrong words** 
`:77` "Every single house in that count is running on 100 % clean wind … zero big-corporation profits" (houses are grid-connected; "zero profits" is a claim for ACE to approve); `:134` "kept **thousands of pounds of choking smoke** out of Bristol's air" (CO₂ is not smoke; "pounds" reads as £ in the UK; the figure is hundreds of kg); `:188` "twice as tall as Big Ben" (150 m vs Elizabeth Tower ≈ 96 m is ×1.6; also `stories-schools.js:133`); "tallest onshore wind turbine in England" / "largest onshore community-owned" are used interchangeably across files (`:187-190`, `SYSTEM_DESIGN.md:38`). BETTER: *"That is the same CO₂ that 122 trees take a whole year to absorb"*; *"taller than the London Eye"* (true at 150 m); get ACE's own wording for the ownership/profit/"tallest or largest" claims and quote it.

**SC-04 · MEDIUM · Claims the data cannot support**
`:26` "Local engineers have already received the call", `:33` "local technicians up in the tower" (a `service_flag` doesn't say where anyone is), `:53` "A gentle, still *afternoon*" at any hour, `:16-19` "turned its giant blades sideways" (MD-01). BETTER: "The turbine has paused for a check." / "The turbine is being serviced." / "The air is still over Lawrence Weston."

---

### 2.17 `schools.html`, `schools.js`, `stories-schools.js`, `schools.css`

**RIGHT**
- Delightful, and the strongest *creative* idea in the repo: a cartoon turbine whose sleepy/blasted/dizzy faces *are* the wind state. Kids will love it and it makes low-wind not look broken.
- Facts that are right: swept area 10,514 m², cheetah comparison, kettle/console arithmetic is plausible and labelled playfully.

**WRONG**

**SH-01 · HIGH · Wrong tower height on screen** (`stories-schools.js:133`, `schools.html:39`)
CURRENT `"My hub is 150 meters tall and my tip reaches 208 meters! … taller than the London Eye (135m) and twice as tall as Big Ben!"` + `stat: "208 Metres"`. The project's own GLB gives hub ≈ 92 m and tip ≈ 150 m (E10); `README.md:16` says 150 m tip. 208 m is the height of a ~215 m-class turbine, not this one. BETTER: `"My blade tips reach 150 metres, taller than the London Eye (135 m)!"` after ACE confirms.

**SH-02 · LOW · "bigger than 1.5 football pitches"** (`:122`) — 10,514 m² ÷ 7,140 m² = **1.47**. BETTER "about one and a half".

**SH-03 · MEDIUM · Same fabrication pattern as CM-02** (`schools.js:205`): `today.energyKwh || Math.max(120, Math.round(powerKw * 3.5))`.

**SH-04 · MEDIUM · The character is "inspired directly by" a stock illustration committed in `referencepics/`** (README:34, INF-04). If the SVG is a faithful redraw it is a derivative work of stock art; if it is original, say so and remove the reference images.

**SH-05 · LOW · Face state is flipped by two competing writers** (`schools.js:105-127`): a 4.2 s `setInterval` toggles the same eye elements `setFaceState` owns, which can briefly open eyes during "sleep" if a blink timer fires mid-transition. BETTER: blink via a CSS class on the SVG group, not by directly toggling `display`.

---

### 2.18 `datascience.html`, `datascience.js`, `datascience.css`

**RIGHT**: the live "you are here" reticle on the empirical power curve is a lovely idea and a genuinely educational picture; canvas drawing is efficient and DPI-naive but fine.

**WRONG**

**DSci-01 · HIGH · Stale hard-coded numbers sit in the HTML as defaults** (`datascience.html:52,57-58,64-65`)
`4,357 kW`, `1.77 GWh`, `78 Days · 2,924 Homes`, `22.1 m/s (4 Sep)`, `76,239 kWh (18 Sep · 75.6 % CF)`, `+32.5 % Generation` are the author's data from one afternoon; any failed `fetch` leaves them looking authoritative (`datascience.js:287, 300` also fall back to `34500000` and "4,200 kW").
**DSci-02 · MEDIUM · Mislabelled cards**: the card titled "ALL-TIME PEAK POWER" is overwritten on every WebSocket tick with the *grid setpoint* (`:295-301`), and "MONITORED YIELD" is overwritten with *lifetime* energy (`:292`). **"Aug vs Sep"** (`:248`) is hard-coded (DB-08).
**DSci-03 · MEDIUM · Audience mismatch**: `IEC 61400-25 SCADA TELEMETRY`, "empirical SCADA 10m bins", "DNO" are exactly the jargon the brief tells you to avoid for a public screen.
BETTER for all three: **cut the page** (§5.3). The challenge asks for a *public* display; the official dashboard and Zenodo already serve researchers. If you want a science nod, put one line + QR ("Researchers: open data on Zenodo, DOI …") in the footer.

---

### 2.19 `admin.html`, `admin.js`

**RIGHT**: preset buttons + sliders + a live JSON inspector is a good rehearsal and debugging rig, and the *only* way to demo calm/curtailed/fault states during a 3-minute pitch. Keep it, locked down.

**WRONG**
**AD-01 · HIGH · See SRV-03** — the page sends no token (`admin.js:71,122,136`) and shows no warning that you are overriding what *public* screens display. BETTER: send `x-admin-token` from `sessionStorage`, and put a red full-width "SIMULATION ACTIVE: public screens show DEMO DATA" bar on admin and (via `freshness:"demo"`) on every display.
**AD-02 · LOW · `alert()` for errors** (`:80,129,139`) is fine for a dev tool; replace with an inline toast if it will be used during the pitch.

---

### 2.20 `chat-widget.js`, `chat-widget.css`

See AI-05 (XSS), AI-06 (public free-text chat), and CM-07 (the FAB overlaps the footer text on the community page). **Cut** (§5.3).

---

### 2.21 `public/css/base.css`, `schools.css`, `datascience.css`, `admin.css`, `chat-widget.css`

**RIGHT**: consistent tokens (`--font-display`, accents), a reduced-motion-agnostic but modest set of animations (pulse dot, clouds, Zzz).

**WRONG**
**BC-01 · MEDIUM · Fonts load from Google at runtime** (`base.css:2`)
```css
@import url('https://fonts.googleapis.com/css2?family=Fredoka…&family=Outfit…&family=Inter…&display=swap');
```
A render-blocking `@import` to a third party on a kiosk: offline ⇒ fallback fonts and layout shift; online ⇒ the community centre's IP is sent to Google on every reload. BETTER: download the three families as `woff2` into `public/fonts/` and use `@font-face { font-display: swap; … }` (all are OFL; add to `ATTRIBUTION.md`).
**BC-02 · LOW · No `prefers-reduced-motion` / no CSS-level kiosk mode.** Not required for a TV, but one `@media (prefers-reduced-motion: reduce)` rule that stops clouds/Zzz is cheap and shows craft.
*Not reviewed in depth: `schools.css` (six `infinite` animations, fine for a secondary page), `datascience.css`, `admin.css`, `chat-widget.css`.*

---

### 2.22 Assets, repo and infrastructure

**RIGHT**
- `.gitignore` covers `.env`, `node_modules`, `data/`, `*.parquet`, `*.db`; no API keys are committed (grep for AIza/gsk_/re_/sk-/PRIVATE KEY found nothing).
- Compose binds DB and Redis to `127.0.0.1`.
- `ACE_Turbine.blend` + `export_glb.py` keep the model reproducible. Good open-source hygiene.
- `npm audit --omit=dev`: 0 vulnerabilities.

**WRONG**

**INF-01 · HIGH · Nothing keeps the kiosk running unattended for weeks**
No Dockerfile (docs promise `build: .`), no `app` service in `docker-compose.yml`, no systemd unit, no kiosk autostart, no screen-blanking/DPMS off, no cursor hiding, no watchdog. `README.md:96-101` is a single Chromium command. A reboot or crash = a black TV until someone logs in.
BETTER (deliverables, ~2 h):
```ini
# /etc/systemd/system/ace-display.service
[Service] ExecStart=/usr/bin/node /opt/ace/server/server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production HOST=127.0.0.1 PORT=4100
```
```bash
# kiosk launcher (Linux; Windows: Task Scheduler + the same flags)
xset s off -dpms; unclutter -idle 1 &
chromium --kiosk --noerrdialogs --disable-session-crashed-bubble --disable-infobars \
  --overscroll-history-navigation=0 --disable-pinch --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 "http://localhost:4100/community.html"
```
Plus a nightly `systemctl restart ace-display` (clears any leak) and a `/health` check (SRV-07).

**INF-02 · MEDIUM · Hard-coded credentials and no `.env.example`** (`docker-compose.yml:10`, `timescaleDb.js:9`, `ingest_zenodo_timescale.py:11`, `datasetService.js:8`). All vanish if the DB/dataset/chat features are cut; otherwise `${POSTGRES_PASSWORD:?set it}` and an `.env.example`.

**INF-03 · MEDIUM · Dependency and repo weight**
`package.json` pulls `better-sqlite3` (native build), `ioredis`, `pg`, and `three`, but `public/vendor/three/` already commits **506 files / 17 MB** (including `three.webgpu*.js` 2.3 MB each, Draco/Basis WASM, 100+ loaders), while the app imports **three files** (`three.module.js` + its `three.core.js`, `GLTFLoader.js`, `OrbitControls.js`, plus `BufferGeometryUtils` that `GLTFLoader` pulls in). `.git` is ~6 MB and growing with binary assets. BETTER: copy only those ~5 files at install (`"postinstall": "node scripts/copy-three.mjs"`) or commit them; remove `three` from vendor tree; drop `better-sqlite3`/`ioredis`/`pg` after cuts → **`express` + `ws` only**. Add `"engines": {"node": ">=20"}` and `"test": "node --test"`.

**INF-04 · HIGH · Licensing: no LICENSE, a watermarked stock image, and an XP wallpaper** (verified E12)
- No `LICENSE` file at all, yet the challenge says "released under an appropriate open licence".
- `referencepics/1000_F_80929606_….jpg` is an **Adobe Stock watermarked preview** (ID 80929606) committed to the repo: redistribution of a comp is a licence breach. The other `referencepics/*` look like Pixabay/stock downloads with unknown terms; `public/img/field-turbine-*.jpg` are byte-identical copies of two of them and are **unused**.
- `public/img/green-hills.jpg` is Windows XP "Bliss" (CM-09).
- `public/img/ace-real-drone.jpg`: provenance and permission unstated.
BETTER: `git rm -r referencepics public/img/field-turbine-*.jpg public/img/green-hills.jpg`; if the repo is already public, also purge history (`git filter-repo --path referencepics --invert-paths`) before submission; add `LICENSE` (MIT or Apache-2.0 for code), `ATTRIBUTION.md` (data: ACE/Zenodo CC-BY citation; fonts OFL; three.js MIT; photo credits; the GLB/blend: who made it and under what licence), and "Data © ACE, CC-BY-4.0" on-screen (already present as constants; actually render them).

**INF-05 · MEDIUM · README "Running Locally" is broken and incomplete**
`npm start` crashes on a clean clone (SRV-02); Python scripts need `pyarrow`, `pandas`, `psycopg2` (no `requirements.txt`), and Zenodo Parquet files that the README never tells you to download; "60 FPS", "Exact 1:1 scale" claims are unmeasured; README advertises `/admin.html` publicly. BETTER: a 5-command quick-start verified on a clean machine (clone → `npm ci` → `cp .env.example .env` → `npm start` → open URL) and a "Kiosk setup" section from INF-01.

**INF-06 · LOW · Repo hygiene**: `WDW_public_display.docx` (the internal day-plan), `ACE_Turbine.blend` (fine, but state its licence), `referencepics/` — move planning artefacts out of the public repo or into `docs/internal/`.

**INF-07 · MEDIUM · No tests.** `metrics.js` is pure and tiny: ten `node --test` assertions (tip speed at 13.5 rpm = 81.8 m/s, Beaufort edges, `null` in ⇒ `null` out, `startOfLondonDay` across a DST change) would catch regressions in exactly the numbers you will be questioned about.

---

### 2.23 The `.md` files

| File | RIGHT | WRONG |
|---|---|---|
| `API_REFERENCE.md` | Precise, well organised, includes polling etiquette and error table. This is the best doc in the repo. | Written from the OpenAPI spec; not shown to have been exercised against the live API. |
| `DATA_DICTIONARY.md` | Valuable field catalogue; the "Static Technical Specifications" idea is right. | **DOC-01 · HIGH**: Hub 150 m / tip 207.8 m (`:195-197`) vs GLB 92/150 m. Cut-out "28–34" and cut-in/rated unsourced. `main_status` mapping (`:178`) unverified. "CO₂ factor ~0.207" has no year. |
| `DATA_SOURCES.md` | CC-BY citation block (`:102-108`) is exactly right; retention table is useful. | **DOC-02 · HIGH** (decision D8): `:26` and `:98` prescribe "ambient simulation mode based on historical averages" when the API is down. That is the origin of fabricated fallbacks (ST-02). Replace with "show last known + age + OFFLINE". |
| `PROJECT_OVERVIEW.md` | Clear brief summary, judging criteria. | **DOC-01** again (`:12`); "20 deliverables" list is a roadmap presented as a spec, nine of which don't exist. |
| `PUBLIC_EXPERIENCE_BLUEPRINT.md` | The *Human-Centric Translation Rulebook* (§1) is the best product thinking in the project: raw tag → sentence → picture. Keep. | **DOC-04 · HIGH**: invented specifics presented as content: "Storm Isha … record 94,000 kWh" (`:135`), "Running at a cool 42 °C today" (`:150`), "anchored deep in the Severn estuary bedrock" (`:151`), "availability 98.7 %", "grid frequency 50.02 Hz" (`:192`) as sample copy, then **indexed by the chatbot as knowledge** (AI-04). Homes = kW ÷ 0.35 (`:224`) with sample "3,600 homes" that does not follow from it. Eight scenes promised, one built. |
| `exploratory analysis.md` | Good questions list; "negative power = parasitic consumption" is a nice insight; the Q→data→display matrix is a strong design tool. | **DOC-03 · MEDIUM**: says "cross-verified" but contains the 0.35 vs "~4,000 icons" contradiction (`:40`) and the 150 m hub. Uses "(~28–32 % CF)" etc. without a computation. |
| `README.md` | Enthusiastic, shows the screens, includes attribution block. | INF-05; claims "authentic 3D … Exact 1:1" and lists "Press B", "Hot-corner", "Admin" as features. |
| `docs/SYSTEM_DESIGN.md` | Diagrams are clear; the failure matrix (§17) is the *right checklist* (and none of its rows is implemented as written: `is_live`, `age_seconds`, "Telemetry Paused" badge). | **DOC-05 · MEDIUM**: describes a system that doesn't exist (pgvector, LangGraph, Chart.js, `/health`, `/api/live`, Resend flow, Nginx, 100+ concurrent users, "sub-second"). Two homes constants (0.9 here, 0.35 elsewhere), capacity factor on 3,500 kW (`:309`), turbine called "E-115/E-126 3.5 MW, 4.2 MW". |
| `docs/ARCHITECTURE_PRUNING_AND_RECOMMENDATION.md` | Correctly prunes Kafka/MinIO/Next.js/Mem0/Tavily. | **D14**: keeps the wrong things (Timescale, pgvector, Redis, LLM adapter, Resend) and says "Already fully implemented" about a 78-day DB. |

---

### 2.24 Addenda found after the first pass

**DB-09 · HIGH · The README's "rebuild from scratch" path is broken by schema drift** (found by reading; not executed because the Timescale container was not available in my sandbox)
`scripts/init_timescaledb.sql:34-45` creates `status_events` **without** `opc_node_id` and with `observed_at` as the primary key, but `scripts/ingest_zenodo_timescale.py:115,144,148` inserts `opc_node_id` and uses `ON CONFLICT (observed_at, opc_node_id)`. The docs schema (`SYSTEM_DESIGN.md:326-330`) *does* have it, so the running DB on your machine was evidently altered by hand. On a fresh `docker compose down -v && up -d` the events step fails; and because the continuous-aggregate refresh sits *after* the events loop (`:164-172`), `daily_rollup` stays empty for history.
CURRENT `init_timescaledb.sql:34-45` (no `opc_node_id`)
BETTER
```sql
CREATE TABLE IF NOT EXISTS status_events (
  observed_at TIMESTAMPTZ NOT NULL, opc_node_id TEXT NOT NULL DEFAULT '', asset TEXT, event_family TEXT,
  main_status INT, substatus INT, fault_message_flag INT, warning_message_flag INT, service_flag INT,
  raw_value TEXT, source TEXT NOT NULL DEFAULT 'zenodo',
  PRIMARY KEY (observed_at, opc_node_id));
```
and refresh the aggregate in a `finally`. *Why:* the "reproduce and adapt" requirement fails at the first command otherwise. (Disappears entirely if the DB is cut, §5.3.)

**INF-08 · LOW · Dead code**: `public/js/realistic-turbine-canvas.js` (348 lines, a 2-D canvas turbine) is imported nowhere; `community.css:441` styles a class that no element has. Delete (judges grep).

---

## Step 3 — Focus areas, in your order

### 3.1 Correctness and robustness: failure-mode matrix

| # | Scenario | What happens today | What should happen | IDs |
|---|---|---|---|---|
| 1 | ACE API unreachable at boot | Fake 185 kW "live", green dot, "2,840 Homes" placeholder (E2/E7) | "Connecting to the turbine…", then `OFFLINE`, no numbers | ST-02, CM-01 |
| 2 | API returns 200 with old data | Shown as live, `connected:true` (E4) | `DELAYED` after 15 s, `OFFLINE` after 2 min, card greyed | ST-01 |
| 3 | API hangs | Poll loop frozen, `connected:true` (E6) | 8 s timeout → counted failure → `DELAYED` | AC-01 |
| 4 | 429/503 | `Retry-After` honoured (good) but staleness not flagged | same, plus chip | ST-01 |
| 5 | Null / `quality:"bad"` | Coerced to 0: "Blades resting peacefully" (E5) | "–", `DELAYED` | ST-03 |
| 6 | Backend dies | Page frozen with green dot indefinitely (E8); nothing restarts Node | `OFFLINE` within 10 s, auto-reconnect with back-off; systemd restarts | WS-01, INF-01 |
| 7 | Malformed WS frame | **Process exits** (E3) | Logged | SRV-01 |
| 8 | Half-open WebSocket | Frozen | 10 s silence ⇒ close and reconnect | WS-01 |
| 9 | GPU context lost / driver reset | Black canvas until a human reloads | Auto-restore, or reload after 30 s | TH-02 |
| 10 | Kiosk power cut / reboot | Black TV: no autostart, no service | Autostart + `Restart=always` | INF-01 |
| 11 | Midnight, DST | "Today" resets at 00:00 **UTC**; hand-rolled SQLite DST is wrong for ~7 days a year. **BST ends Sunday 25 Oct 2026, three days before the pitch**; keep a test for the 25-hour day | London midnight via `Intl`; tests | ST-05, DB-04 |
| 12 | Weeks of uptime | Server: log growth (SRV-04), unbounded maps if chat used (RD-02). Browser: I found no leaking timers or DOM growth (two `setInterval`s, bounded). But **`loadHistoricalRecords()` runs once per page life** (`community.js:283-295`), so "record day" is frozen until a reload | Hourly refresh or the nightly reload | SRV-04, RD-02, WS-01 |
| 13 | Admin leaves simulation on | Fake data forever; dot turns amber | Auto-revert after 10 min; red DEMO banner | SRV-03 |
| 14 | In-flight poll vs simulate | Live values overwrite simulation (E9) | Re-check mode after every `await` | ST-06 |
| 15 | ACE renames a field | `last([])` ⇒ `undefined` ⇒ silent 0; 400 is retried 3× | `OFFLINE` with a reason in `/health` | AC-02, ST-03 |
| 16 | Clock skew on kiosk PC | n/a today | `ageSec` is computed on the server, so a wrong PC clock cannot fake freshness (keep it that way) | ST-01 |

Timers that never clear: the three `setTimeout` loops in `state.js` and the story `setInterval` are by design process/page-lifetime; I found no accidental leak. `startSyncJob()` returns a stop function nobody calls (harmless).

### 3.2 Data honesty: every derived number

| # | Number on screen | Where | Formula as coded | Assumption stated on screen? | Defensible? | Fix |
|---|---|---|---|---|---|---|
| 1 | "N Homes lit up across Lawrence Weston right now" | `metrics.js:13-16`, `stories-community.js:72-98` | kW ÷ 0.35 | No | Arithmetic fine (0.35 kW ≈ 3,070 kWh/yr, slightly above Ofgem medium 2,700). **Wording false and scale implausible**: 12,000 at rated power vs "~3,500–4,000 homes/yr" in your own docs | CO-01 |
| 2 | "~8,857 local homes" (status pill) | `community.js:106` | same | No | Same; and visibly different from #1 on the same screen (E7) | CO-01, CM-01 |
| 3 | Homes in chat | `aiAgent.js:21,31,175` | ÷ 0.9 kW and ÷ 8.2 kWh/day | No | Three constants across the app (0.35, 0.9, 8.2/day≈0.34) ⇒ answers differ by 2.6× | AI-02 |
| 4 | "homes … for a full year" | `timescaleDb.js:166`, `aiAgent.js:186` | E ÷ (2,900/365 × days) | No | Average homes over the window, mislabelled "for a full year" | DB-05 |
| 5 | Today's energy | `state.js:104-121` | last − first cumulative row since 00:00 UTC | No | Misses the first interval; UTC not London; assumes a cumulative counter (unverified) | ST-05 |
| 6 | Today's energy when unknown | `community.js:125`, `schools.js:205` | `max(250, max(10,kW)×4)` | No | **Fabricated**, and feeds CO₂, trees, £ | CM-02 |
| 7 | "kg of CO₂ kept out of the air" | `metrics.js:18-21` | kWh × 0.207 | No (vintage unstated) | Reasonable if you say "using the UK grid average, DESNZ 20xx" | CO-04 |
| 8 | "N trees" | `metrics.js:23-26`, `stories-community.js:130` | kg ÷ 21, floor 25 | No | Units mismatch (per-year vs "today"); floor invents | ME-03, SC-01 |
| 9 | "£62 raised today for heating vouchers" / "~2 vouchers" | `metrics.js:29-32`, `stories-community.js:100-127` | MWh × £5; £ ÷ £30 | "(est.)" only | **Invented rate** applied to a charity's income | CO-02 |
| 10 | Blade tip speed (mph) | `metrics.js:34-41` | rpm·2π·r/60 ×2.237 | n/a | **Correct** (13.5 rpm ⇒ 183 mph) | keep |
| 11 | "10,514 m² … bigger than 1.5 pitches" | `stories-schools.js:122-124` | πr² | n/a | Area right; 1.47 pitches, not "bigger than 1.5" | SH-02 |
| 12 | Kettles / consoles | `stories-schools.js:67-68` | kW÷2.2, kW×10 | No | Fine for kids if "about"; state 2.2 kW/100 W | label |
| 13 | Capacity factor | `metrics.js:43-48`; SQL | lifetime ÷ (4,245 × h) vs 3,500 / 4,200 elsewhere | No | Three denominators in one repo | DB-07 |
| 14 | "Record day: X kWh on 18 September" | `timescaleDb.js:120-124`; `community.js:161` | per-day MAX−MIN ÷ (4,200·24) | No | Window = 78 days; **date typed in** | CM-04, DB-05 |
| 15 | "All-time peak 4,357 kW" | `timescaleDb.js:113`, `datascience.html:52` | max of 10-min max | No | Above 4,245 kW nameplate | DB-06 |
| 16 | "1.77 GWh produced so far" | `community.js:164` | Σ daily deltas (78 days) | No | Lifetime meter is of the order of 30+ GWh (docs/defaults say 30.6–34.5) | DB-05, CM-04 |
| 17 | Lifetime GWh | `datascience.js:287` | meter or `34,500,000` default | No | Source is right (`wec_energy_exported`); the `||` default is fiction | DSci-01 |
| 18 | "Fresh breeze", "Gale" | `metrics.js:50-61` | Beaufort bands on hub wind | No | Bands right; hub (92 m) ≠ 10 m | ME-02 |
| 19 | "Hub 150 m / tip 208 m" | `stories-schools.js:133`, `DATA_DICTIONARY.md:195-197` | typed | No | GLB ⇒ hub ≈ 92 m, tip ≈ 150 m | SH-01, DOC-01 |
| 20 | "Holding back so power lines stay safe" | `turbine-mood.js:28-33` | `main_status==1 && avail < 0.95×theoretical` | No | Rests on unverified status codes; claim about National Grid's reason | ST-08 |
| 21 | "England's tallest / largest community-owned onshore" | `community.html:99`, stories, chat | typed | No | Three phrasings across files; unsourced | SC-03 |

**Rule I recommend**: every number on screen is either (a) measured and timestamped, (b) computed from (a) with a formula and constant listed in `FACTS` and shown on a one-screen "How we calculate this" panel (or QR), or (c) not shown.

### 3.3 Public-audience UX

**What a non-technical resident sees in the first 10 seconds (observed, E7, 1920×1080):**
1. 0–8.5 s: a big card "Lighting Up Our Neighborhood Right Now / 2,840 Homes", a dark-green 3D turbine in front of a stylised hill, and a tiny pill "Generating clean wind energy for ~8,857 local homes". Two numbers, neither labelled live, no timestamp, no current power, no wind.
2. 8.5 s: the card swaps to the next beat. There is **never an always-visible "how much is it making right now"**.
3. The chat button and a hot-nav ghost compete for the corners; a "Drag to rotate" hint addresses a mouse the room doesn't have; US spelling ("Neighborhood", "neighbors" in 6 places) on a Bristol screen.

**Readability from 3 m**: see table in CM-06: headline and stat are fine; everything that qualifies them is not.

**Jargon and register**: community page is good (no kW/kWh). Remaining offenders: "Enercon E-115" (badge), "feathered" (README text), "curtailed", "DNO", "SCADA", "IEC 61400-25" (Data Science page).

**Motion**: the only motion that earns its place is the rotor (real RPM). The 8 s story swap uses `translateY(±16px)` plus a 0.35 s fade (`community.css:407-427`); keep fade only, and slow to 12 s for sentences of this length (about 25 words at 3 m ≈ 10 s reading time). The photo cross-fade with `scale(1.02→1)` is gratuitous. No attract-mode, particles or parallax were found; good (nothing distracts).

**Low-wind, fault, offline states**: this turbine runs at a capacity factor of roughly 26–28 %, so *below full output is its normal state* and a fully calm spell is common enough that the screen must handle it; today that state is a generic "Peaceful skies" card with a guessed time of day. Proposed states, using only observable facts:

| State | Headline (≥ 60 px) | Sub-line (≥ 36 px) | Visual |
|---|---|---|---|
| Generating | "Making electricity right now" | "3.1 MW: 74 % of full power · wind 9 m/s at the turbine" | Rotor at real RPM, gauge bar |
| Idling | "Turning slowly" | "Light wind (4 m/s). It needs about 12 m/s for full power." | Gauge with cut-in/rated ticks |
| Calm | "Resting: the air is still" | "Wind 1.8 m/s; the turbine starts at 2.5 m/s. **Today so far: 12,400 kWh.**" | Dimmed rotor, Zzz mascot (schools face, small) |
| Paused (not generating despite wind) | "Paused right now" | "Not generating at the moment. Back soon." | Neutral icon; no cause claimed |
| Fault / Service | "Paused for a check" / "Being serviced" | "Today so far: …" | Never "engineers notified" |
| Curtailed (only if ACE confirms the codes) | "Asked to ease off" | "The grid has asked all wind farms to reduce output." | |
| Delayed / Offline / Demo | chip only (CM-03) + greyed card | last-known time | |

**A first-10-seconds layout that survives a glance (1080p, all text ≥ 29 px):**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ ● LIVE · updated 2 s ago                          Ambition Community Energy │
│                                                                            │
│  RIGHT NOW                                       ┌───────────────────────┐ │
│  3.1 MW           ▓▓▓▓▓▓▓▓░░░░ 74 % of full power │                     │ │
│  "As much electricity as 9,000 homes use at once"  │   3D turbine,        │ │
│                                                    │   real RPM,          │ │
│  TODAY                SINCE 2023                   │   sky = real sky     │ │
│  28,400 kWh           34.6 GWh                     │                      │ │
│  = 3,460 homes        = x years of Lawrence        └───────────────────────┘ │
│    for a day            Weston's electricity (if ONS count is used)         │
│ ────────────────────────────────────────────────────────────────────────── │
│  rotating beat (wind · clean air · pride · record day)  — 12 s, fade only   │
│  Data: ACE Wind Turbine Data, CC-BY-4.0 · doi:10.5281/zenodo.22662372       │
└────────────────────────────────────────────────────────────────────────────┘
```
Three pinned numbers (Now / Today / Since 2023) answer the question every passer-by has; the rotating beats add heart. This is the single biggest lever on *Public accessibility* and *Effective use of live data*.

**Accessibility minimums**: do not rely on colour alone (the dot) for state, so the chip carries words; `role="status"` on the chip (done in CM-03); contrast of `#334155` on near-white is fine, but check pills over photos; add `@media (prefers-reduced-motion)`.

### 3.4 Architecture: over-engineered and missing

**Over-engineered for 3 weeks / 1 screen (cut or avoid)**: TimescaleDB + SQLite (two copies of one table) + continuous aggregates; Redis; pgvector/LangGraph (documented, not built); keyword "RAG" over your own README; LLM provider adapters; Resend email; HMAC dataset tokens; Docker for the *kiosk*; Nginx; three audience personas; an admin simulator that can steer public screens. Each is defensible alone; together they are ≈ 4,000 lines (and 17 MB of vendored three.js) to explain in a 3-minute pitch, and every one is a way to fail while unattended.

**Missing that the audience will notice** (in priority order): (1) a live power figure and "% of full power" gauge; (2) a LIVE/last-updated cue; (3) day/night and real weather; (4) "today's shape": an area chart of today's output (the blueprint's "Scene 2" promised it; one cached 10-minute range call per minute, no DB); (5) a sourced community-benefit fact (what the money *did*), not an invented rate; (6) a QR to ACE/ALW and to the open data; (7) a "how it works in 3 steps" beat (wind → blades → generator, with the cut-in/rated markers); (8) on-screen CC-BY credit at a readable size; (9) a designed low-wind state.

**Lean target architecture (my recommendation)**
```
ACE API ─▶ Node (express + ws, ~300 lines, deps: express, ws)
            ├─ in-memory poller: now (1 req/s), today (60 s), status (5 s), daily history (1 h)
            ├─ GET /health   (freshness, build id)        ├─ WS /ws  (snapshot() every 1 s)
            └─ serves /public  (self-hosted fonts, 5 three files, GLB)
Host:  small VPS (judges can open the URL too) + kiosk PC runs only Chromium pointed at it,
       with the page cached by a service worker so a network blip shows OFFLINE, not a blank tab.
```

### 3.5 Open-source readiness

| Item | Status | Action |
|---|---|---|
| Licence file | **Missing** | Add `LICENSE` (MIT/Apache-2.0 code); state content licences separately |
| Data attribution (CC-BY-4.0) | In docs and constants; **not rendered on the screen at readable size** | Render `ATTRIBUTION_TEXT` in the footer (≥ 22 px) and in a QR "credits" page |
| Third-party assets | XP wallpaper, Adobe Stock comp, unknown drone photo, Pixabay images (unused) | INF-04 purge + `ATTRIBUTION.md` |
| three.js / fonts | MIT header present in `three.module.js`; no LICENSE copy; fonts via Google CDN | Ship `LICENSES/` (three MIT, Outfit/Inter/Fredoka OFL), self-host fonts |
| 3D model | `ACE_Turbine.blend` + GLB + `export_glb.py` | State author and licence of the model |
| Secrets | None real committed; **default secrets are** (DS-01, INF-02) | `.env.example`, fail-closed |
| Setup steps | `npm start` crashes on a clean clone; Python deps/Zenodo files undocumented; compose lacks the app | INF-05, INF-01, DB-09 |
| Reproducibility | No tests, no CI, no lockfile problems (lockfile present) | `node --test`, GitHub Action running tests and `npm audit` |
| Submission mechanics | WeDoWind "Solutions" comment + optional PR to `WeDoWind/WeDoWind-ODE-ACE-Challenge` | Prepare URL + 2 screenshots + 100-word description + PR by ~24 Oct |
| Docs vs code | Docs describe unbuilt systems | DOC-05: rewrite `docs/` to what exists; move aspiration to `ROADMAP.md` |

### 3.6 Performance on a modest screen PC

I could not measure on a real GPU (headless Chromium used software GL), so the following is analysis plus a measurement plan, not benchmarks.

| Source | Cost driver | Fix |
|---|---|---|
| WebGL scene | MSAA, DPR up to 2 (4K ⇒ 8 M px), 2048² soft shadow map, 60 fps always | TH-01: DPR 1, no MSAA, 1024², 30 fps |
| CSS compositing | six `backdrop-filter` layers (12–28 px), CSS `drop-shadow` on the canvas wrapper, two `will-change` full-screen layers | CM-12 |
| Fonts | blocking cross-origin `@import` | BC-01 |
| JS | trivial: one WS message per second, DOM updates of ~8 nodes every 8 s | none |
| Server | `JSON.parse(JSON.stringify(state))` per publish; trivial at 1 Hz | none |
| Memory | page: flat by inspection; server: SRV-04, RD-02 | cut chat/Redis |

**Measurement plan (30 minutes, do it on the real PC)**: (1) Chrome DevTools → Performance, record 10 s, read GPU and main-thread %, before/after TH-01/CM-12; (2) `chrome://gpu` to confirm hardware acceleration is on; (3) soak: leave `community.html?kiosk` running 48 h and log `performance.memory.usedJSHeapSize` (launch with `--enable-precise-memory-info`) and `process.memoryUsage().rss` to `/health` every 5 min; pass = heap and RSS flat within ±10 %; (4) pull the network cable for 10 minutes and confirm `OFFLINE`→`LIVE` without human action; (5) `kill -9` the server and confirm systemd restarts it and the page recovers.
Budget to aim for: < 25 % of one core and < 40 % GPU on an Intel UHD-class iGPU, 30 fps steady.

---

## Step 4 — Where I disagree with your documented decisions

I disagree with these, in order of how much they matter. "Rework" is my estimate.

**D8 — "When the API is down, run an ambient simulation from historical averages" (`DATA_SOURCES.md:26,98`). Wrong; reverse it.**
Showing simulated numbers as live is the root of ST-02/CM-01/CM-02. The honest design: keep the last real reading, label it with its age, grey the card, say OFFLINE. *Alternative:* `freshness` states (ST-01). *Rework:* part of Top-10 #1 and #6.

**D9 — Turbine spec in the docs (150 m hub, 207.8 m tip).** The GLB you built says ≈ 92 m hub, ≈ 150 m tip, consistent with a 92 m-hub E-115 option and with what your README says. Correct `PROJECT_OVERVIEW.md`, `DATA_DICTIONARY.md`, the schools copy and the chat prompt, then ask ACE to confirm. *Rework:* 30 min.

**D6 — "Homes powered = kW ÷ 0.35" as the hero metric, and the 0.9 variant.** Keep one yardstick, phrase as equivalence, and make "today = N homes for a day" the stable headline (CO-01). *Rework:* 1 h.

**D7 — Community fund = MWh × £5 shown as "raised today".** Remove; use an ACE-sourced static fact (CO-02). *Rework:* 30 min + an email to ACE.

**D4 — "Ask the Turbine" free-text LLM chat (Gemini/Groq, RAG, LangGraph) on the public screen. Cut it.**
It is the weakest item for a community TV (no keyboard, moderation, API-key risk, off-brand answers, XSS), the strongest *demo risk* (a third-party API in a live pitch), and the biggest source of inaccurate numbers (AI-01/02). *Alternative that keeps the "ask" feeling:* six curated question cards that rotate on screen and are answered from live data with human-written templates ("Is it spinning right now?", "How windy is it?", "How much did it make today?", "Why is it standing still?"), plus a QR to ACE's FAQ. *Rework:* delete ~1,100 lines; add ~60.

**D5 — Email-gated dataset delivery.** Cut. The data are CC-BY and free on Zenodo; gating contradicts the brief, creates an open email relay (DS-02) and cannot work on a fresh clone (DS-04). Put the DOI + QR in the footer. *Rework:* delete ~300 lines.

**D2/D3/D14 — TimescaleDB + SQLite + Redis, and "keep pgvector/Redis/Timescale" in the pruning doc.** I agree with pruning Kafka/MinIO/Next.js/Mem0/Tavily; I disagree with what was kept. The ACE API already serves `daily` data from commissioning and 10-minute data for a year; the lifetime meter is live; the DB currently holds 78 days and mis-reports "all-time". *Alternative:* in-memory poller + one hourly cached `daily` call (DB-02). *Rework:* net saving of hours; removes two containers, a native module and ~1,400 lines.

**D1 — Four audience pages + eight-scene blueprint.** The brief says "designed primarily for a non-technical public audience"; judges vote on a 3-minute pitch. Three of four pages dilute that and double the surface to keep honest. *Alternative:* one polished community screen; fold the best idea of the schools page (mascot face for wind state) into a small corner element or a "kids' corner" beat; replace Data Science with a footer QR. *Rework:* removal ≈ 1 h; the redesign is Top-10 #10.

**D10 — "Kiosk PC runs Node and Docker for Postgres/Redis" (README:96-113).** A modest PC should run only a browser. *Alternative:* host the Node app (or run it alone locally if there is no internet-facing host) and point the kiosk at a URL; add a service worker so the page shell survives network loss. *Rework:* 2 h.

**D11 — "100+ concurrent visitors, sub-second, < 100 ms, Nginx on Contabo".** Unmeasured claims in a repo that will undergo "technical review". Replace with what is true (1 Hz poll, 1 s broadcast, N screens) and what you tested. *Rework:* 30 min.

**D12 — "Interactive orbit, press B, hot-corner switcher" as features.** On a wall-mounted screen they are dead UI. Replace with a slow automatic camera drift and a `?dev` mode. *Rework:* 1 h.

**D13 — The project docs are the chatbot's knowledge.** Reverses itself once D4 is cut; but note the docs contain invented facts (DOC-04), so they must never be shown verbatim to the public.

**On the plan itself (`WDW_public_display.docx`)**: its Day 2 and Day 4 requirements ("timeout handling", "stale-data detection", states `NO DATA / DATA DELAYED`, "mock-data mode") are exactly the robustness items the code lacks; its Day 12 (QR→mobile→AI) is where the schedule went. I would trade Day 12's AI for those states.

---

## Step 5 — What to do, what to leave, what to cut, and the risk

### 5.1 The 10 most important fixes, ranked by (impact on winning) ÷ (effort)

Impact is a 1–10 judgement of effect on the *vote* and *judge's award*; effort is my estimate for someone who knows the code.

| Rank | Fix | Closes | Impact | Effort | Score |
|---|---|---|---|---|---|
| **1** | **Delete every invented number, placeholder and "floor"**; `null` ⇒ hide the beat or show "Connecting…" (`state.js:10-27`, `community.html:66`, `community.js:125`, `stories-*.js` floors, `schools.js:205`, datascience defaults) | ST-02, CM-01, CM-02, SC-01, SH-03, DSci-01 | 9 | 2 h | 4.5 |
| **2** | **Correct the claims and constants**: heights (92 m hub / 150 m tip), Big Ben, "tallest/largest", homes as equivalence + "homes for a day", CO₂ wording + vintage, remove the £/vouchers story or replace with an ACE-sourced static fact; create `FACTS` with `source/checkedOn` (needs a reply from ACE for 3 items) | CO-01..04, SC-02..04, SH-01/02, DOC-01 | 8 | 2 h (+ wait) | 4.0 |
| **3** | **Clean up licences and assets**: remove XP wallpaper, Adobe Stock comp, unused/unknown images; add `LICENSE`, `ATTRIBUTION.md`; credit on screen; self-host fonts; replace the sky (CSS gradient first) | CM-09, INF-04, BC-01 | 7 | 2 h | 3.5 |
| **4** | **Crash-proofing**: `ws` `'error'` listener + heartbeat + `maxPayload`; `AbortSignal.timeout` on all fetches; create `data/` (or cut SQLite); exit-on-uncaught; systemd/Docker `Restart=always`; admin token + simulation auto-expiry + DEMO banner; `/health` | SRV-01/02/03/07, AC-01/02, AD-01, INF-01 | 9 | 3 h | 3.0 |
| **5** | **Performance and stability pass**: DPR 1, no MSAA, 1024² shadows, 30 fps; remove six `backdrop-filter`s and the canvas `drop-shadow`; WebGL context-loss recovery; nightly reload; measure on the real PC + 48 h soak | TH-01/02/03/05, CM-12 | 7 | 3 h | 2.3 |
| **6** | **Freshness truth end to end**: sample age from ACE timestamps, 1 s heartbeat, `freshness` in every snapshot; LIVE/DELAYED/OFFLINE/DEMO chip and greyed card; WS watchdog and back-off | ST-01/03/04/06, CM-03, WS-01 | 9 | 4 h | 2.25 |
| **7** | **Cut scope and stack**: delete chat/RAG/Redis/dataset/SQLite/Timescale/Data-Science/admin-HTML-from-kiosk; history from one cached API `daily` call; trim `vendor/three`; drop to `express` + `ws` | AI-*, DS-*, RD-*, DB-*, DSci-*, SRV-05/06, INF-02/03/08 | 6 | 3 h | 2.0 |
| **8** | **Live sky and day/night**: sun-elevation (or turbine lux) → CSS palette and three.js light; weather-aware mood (rain/visibility if available); remove "afternoon" copy | CM-10/11, SC-04 | 7 | 4 h | 1.75 |
| **9** | **Reproducibility pack**: 5-command README verified on a clean machine, `.env.example`, kiosk scripts (systemd + Chromium flags, screen blanking off, nightly restart), `node --test` for `metrics.js` + London-midnight, GitHub Action | INF-05/06/07, DB-09 | 5 | 3 h | 1.7 |
| **10** | **Rebuild the first 10 seconds**: Now (MW + % of full power + plain sentence), Today, Since 2023 pinned; text ≥ 29 px with root-scaled `rem`; remove dev UI; designed low-wind/fault/paused states; fixed-order beat list; remove US spellings | CM-06/07/08, MD-01, ME-01/02, NAV-01 | 10 | 9 h | 1.1 |
| | **Total** | | | **≈ 35 h** | |

Note on order: rank 10 has the lowest ratio only because it is the largest piece of work; it is the fix that most moves the vote. **Do 1–4 and 6 in week 1** (≈ 14 h) so the foundation can't embarrass you, **10, 5, 7 in week 2**, **8, 9 in week 3**, then rehearsal; target the submission for ~24 Oct, keeping the 25 Oct BST→GMT change and the 28 Oct pitch clear of last-minute changes.

### 5.2 Leave it alone (good enough)

- The **GLB model and its rotor/yaw hierarchy**, real-scale, 1.1 MB, no textures (`public/models/ace_turbine.glb`, `export_glb.py`, `ACE_Turbine.blend`).
- **Rotor at the real RPM with inertia** (`three-turbine.js:250-256`), the beacon pulse, `dt` clamping.
- **`aceClient.js` retry/`Retry-After`/User-Agent logic** (needs only the timeout, AC-01).
- **The single-poller + WebSocket fan-out pattern** and the snapshot-on-connect (`state.js`, `server.js:292-298`).
- **`ws-client.js` reconnect skeleton** (add watchdog, WS-01).
- **`metrics.js` structure, tip-speed and Beaufort tables**, `constants.js` `ASSUMPTION` culture (extend to `FACTS`).
- **The plain-English tone** and the *Human-Centric Translation Rulebook* in `PUBLIC_EXPERIENCE_BLUEPRINT.md` §1 (fix numbers, keep the thinking).
- **`PRESETS` in `state.js`** (hardened) for rehearsal and for demonstrating states in the pitch.
- **`TurbineAnimator`**, `story-rotator.js`, the mood-to-text map structure (after MD-01).
- **`API_REFERENCE.md`, `DATA_DICTIONARY.md` (apart from the spec table), `DATA_SOURCES.md` §4 attribution**.
- **Schools cartoon character** *as an idea* (keep only if it is a corner element or an optional beat; resolve SH-04).
- `.gitignore`, loopback bindings in compose, parameterised SQL (if any SQL survives).

### 5.3 Cut it (not worth the remaining time)

1. **"Ask the Turbine" chat**: `aiAgent.js`, `ragKnowledge.js`, `chat-widget.js/.css`, `/api/chat`, WS `chat.*` handler, Gemini/Groq/OpenAI code, `redisClient.js`, `ioredis`.
2. **Dataset request/email flow**: `datasetService.js`, `/api/datasets/*`, the modal, Resend, `dataset_downloads`.
3. **Both history stores and their sync jobs**: `db.js`, `syncJob.js`, `timescaleDb.js`, `timescaleSyncJob.js`, `scripts/*` (Python), `docker-compose.yml`'s Timescale/Redis, `better-sqlite3`, `pg`. Replace with one cached `daily` API call.
4. **Data Science page** (`datascience.*`, power-curve canvas, the invented "theoretical curve"): replace with a footer QR to the official dashboard + Zenodo.
5. **`admin.html` on the public host**: keep as a local rehearsal tool behind `ADMIN_TOKEN`; do not serve it by default.
6. **Dev navigation**: hot-nav drawer, `B`/drag/orbit hints, environment switcher pill, drone/hills toggle.
7. **`realistic-turbine-canvas.js`** (dead), `referencepics/`, `public/img/field-turbine-*.jpg`, `green-hills.jpg`, `WDW_public_display.docx`, 17 MB of unused `vendor/three`.
8. **Docs that describe unbuilt systems** (`SYSTEM_DESIGN.md` §§5, 13-16, 18, 20; pruning doc; 20-deliverable list): move to `ROADMAP.md` or delete.
9. **Blueprint scenes 3, 4, 6, 7, 8** (historical hall of fame, nacelle cutaway, timeline, data lab, chat). Do Now/Today/Since + beats + live sky well instead.

### 5.4 The single biggest risk to winning

**Showing a confident wrong or stale number to the people who own the turbine.**

The audience for the vote includes ACE staff and Lawrence Weston residents who *know* the real answers. Today the screen can say: 12,000 homes in a ward that has a few thousand; a 208 m tower; "£62 raised today"; "1.77 GWh so far"; "twice as tall as Big Ben"; the Windows XP wallpaper behind it; and the same "Generating clean wind energy" with a green dot after the backend has died. Any one of those, spotted live in the 3-minute pitch or in the repo review, converts a creative, warm entry into "this isn't trustworthy" and sinks *Effective use of live data* and *Practicality & robustness* with it. The fixes are small, specific and in this document (ranks 1, 2, 3, 4, 6).

**Mitigations for the pitch itself**: (a) rehearse with the admin presets labelled DEMO and with a deliberate network pull to show `OFFLINE → LIVE` (turns the biggest risk into a feature); (b) have a 60-second screen recording ready in case the venue network fails; (c) freeze code after ~24 Oct, including dependency updates.

---

## §6 — Questions to close with ACE / you (they change what I'd build)

1. **Heights**: confirm hub and tip height, and the exact wording for "tallest / largest onshore (community-owned) turbine in England".
2. **Homes yardstick**: what does ACE publish ("~N homes")? Which household-use figure and year? Is there an ONS household count for Lawrence Weston you want used?
3. **Community fund**: is there a publishable £/MWh, an annual £ figure, or "what the money did" facts? (Otherwise no £ on screen.)
4. **Photos**: who owns `ace-real-drone.jpg`, and may it be redistributed under your chosen licence? Any ACE-owned hero photo?
5. **Data semantics**: is `energy_produced` cumulative (10m and daily)? Does `wec_instantaneous` allow `60s` range for `wec_energy_exported`? Are `ambient_brightness_mean`, `precipitation_mean`, `visibility_mean` populated at 10 m? What do `main_status` 0/1/2/9 mean?
6. **Peak power**: is 4,357 kW a real reading or a glitch?
7. **Kiosk hardware**: CPU/GPU, OS, screen size and resolution, keyboard/touch availability, whether the centre's network is reliable and whether a hosted URL is acceptable to ACE ("subject to technical review").
8. **Licence preference** for code (MIT vs Apache-2.0) and the 3D model/photos.

---

*Stopping here as instructed. Tell me which fix IDs (or Top-10 ranks) to apply and I'll do exactly those, one commit per rank, and not touch anything else.*
