# Weston Wind

*Live wind. Local energy. A turbine you can talk to.*

Weston Wind is the public face of the **ACE community wind turbine** in Lawrence Weston, Bristol
(Enercon E-115 EP3, 4.2 MW): three storytelling hoarding screens with a native Three.js turbine,
a private phone chat ("Ask Ace") opened from a QR code, a public website, a developer portal and an
operator console with a wind simulator.

Built for the WeDoWind "ACE Wind Turbine Public Display" open-data challenge (see [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)).

| Route | What it is |
| --- | --- |
| `/` | Website: live figures, how it works, the screens, a scroll-driven "look inside", day in the life |
| `/developers` | Developer portal: live endpoint explorer, code samples, open-data downloads |
| `/screen/students` | Hoarding screen — cartoon turbine, kid-friendly story |
| `/screen/community` | Hoarding screen — realistic turbine standing in the Lawrence Weston 3D scan |
| `/screen/college` | Hoarding screen — blueprint turbine, power curve, technical story |
| `/ask/:screen` | Phone chat opened from each screen's QR code (no login) |
| `/admin` | Operator console: simulator, weather scenarios, presets, screen remote, endpoint health |

## The hoarding screens

- **Native Three.js** turbine from `assets/source/ace-turbine.blend` (exported, meshopt-compressed to
  `frontend/public/models/ace-turbine.glb`), plus a procedural interior: ladder, service lift,
  platforms, cable loop, converter cabinets, yaw ring and drives, copper stator coils.
- **Live**: the rotor turns at exactly the rpm the API reports (eased like a heavy rotor), and the
  nacelle yaws to the live bearing.
- **Look inside**: one value `U` (0 → 1) drives four effects at once:
  section cutaway (clipping plane with a solid cap), exploded view (front halves slide out
  `3.5 m × U`), ghost / x-ray (`opacity = 1 − 0.92 U`, depth write off) and a camera fly-in that docks
  in the machine room or at the tower base.
- **Story loop**: chapters with live copy and camera moves advance on their own (GSAP). Touching the
  screen or a phone command pauses the loop so the visitor stays in control.
- **Three looks, one hue**: cartoon (toon shading + ink outlines), realistic (PBR in the gaussian-splat
  scan of the site, via Spark), blueprint (glowing edges over translucent solids).
- Drag to orbit, pinch / wheel to zoom, double-tap to look inside.

## Ask Ace — the phone chat

- Each browser tab gets an anonymous, **server-signed session token** (kept in `sessionStorage`).
  History is stored per session id only, so two visitors never see each other's messages, and a
  reload keeps the conversation.
- Replies **stream** over Server-Sent Events. The agent calls tools for live status, history,
  the project knowledge base (BM25 RAG over the docs in this repo), optional Tavily web search, and
  `show_on_big_screen`, which sends a fixed animation name (never text) to the screen the visitor scanned.
- Works with Anthropic (Claude Haiku by default), OpenAI, Groq, Gemini or any OpenAI-compatible
  endpoint; without a key it answers from templates.

## Running it

```bash
npm run setup          # installs the server and the frontend
cp .env.example .env   # add your keys (never commit .env)
npm run build          # builds the React app into frontend/dist
npm start              # http://localhost:4100
```

Development with hot reload: `npm run dev` (API on :4100) and `npm run dev:web` (Vite on :5173,
proxying `/api` and `/ws`).

Kiosk PC (one per hoarding):

```bash
chromium --kiosk --noerrdialogs --disable-session-crashed-bubble --incognito http://localhost:4100/screen/community
```

Set `PUBLIC_ORIGIN` to the public URL so the QR codes point phones at the right place.

## Admin and simulation

`/admin` drives every screen with demo data (protect it with `ADMIN_TOKEN`):

- **Wind simulator**: choose wind speed and bearing; power and rotor speed come from the E-115
  reference curve (`shared/physics.js`). Toggles for curtailment, fault, technicians on site,
  warning, or manual power / rpm.
- **Weather scenarios**: morning wind-up, gusty afternoon, storm front (storm control above 28 m/s),
  wind veering north, evening lull.
- **Presets**, a **remote** for each connected screen, a **live 3D preview**, and an
  **endpoint health** check of every API route.

## Project layout

```
server/            Express API, WebSocket hub, chat agent, data jobs
  chat/            sessions, history store, agent loop, LLM providers, tools, personas
  routes/          state, history, datasets, chat (SSE), screens, admin
shared/            constants, impact maths and turbine physics used by server and frontend
frontend/          Vite + React + Tailwind v4 + GSAP
  src/three/       TurbineScene, camera rig, look-inside, interiors, landscape, splat, themes
  src/pages/       landing, developers, screens, ask, admin
assets/source/     the turbine in .blend / .glb / .fbx / .obj
scripts/           GLB export, Zenodo ingest, landing-page 3D stills (render-stills.mjs)
```

The 3D stills on the landing page are rendered from the real scene with
`npm run render:stills` (server running, Playwright installed).

## 🗄️ TimescaleDB Historical Data Layer

The project includes an embedded TimescaleDB time-series engine for gapless multi-month SCADA telemetry, continuous aggregate daily rollups, and long-term comparisons.

### 1. Start the Database
```bash
docker compose up -d
```
*(Runs Postgres 16 + TimescaleDB bound strictly to `127.0.0.1:5432`, data persisted in Docker volume `timescaledb_data`)*

### 2. Ingest Zenodo Historical Archive
To ingest all historical 10-minute moments and status events from Zenodo Parquet releases into the `scada_10m` hypertable:
```bash
python scripts/ingest_zenodo_timescale.py
```
- Performs idempotent upsert (`ON CONFLICT (ts) DO UPDATE`) with `source='zenodo'`.
- Automatically calls `refresh_continuous_aggregate('daily_rollup', ...)` for the affected range.

### 3. Automated Live Sync Job
- When the server starts (`npm start`), the sync job runs immediately and on a recurring 12-minute schedule.
- Fetches newly available `wecstd/range` SCADA moments from the live ACE API, gap-fills downtime, and inserts with `ON CONFLICT (ts) DO NOTHING` and `source='live'`.
- If TimescaleDB is stopped or offline, the application gracefully continues running in live in-memory mode without crashing.

### 4. Rebuild from Scratch
To completely reset the database and re-ingest all history:
```bash
# 1. Wipe database volume and container
docker compose down -v

# 2. Re-create container and apply initial schema
docker compose up -d

# 3. Re-ingest Zenodo historical datasets
python scripts/ingest_zenodo_timescale.py
```

---

## 🏗️ End-to-End System Workflow & Implementation Guide

This project transforms raw SCADA telemetry and historical research datasets into an interactive, 3D public kiosk and conversational AI experience. Everything is self-contained and runs on a single inexpensive server or local machine with **zero paid cloud accounts**.

### High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   EXTERNAL DATA SOURCES                                │
│   Zenodo Parquet Releases (July-Sept)        Live ACE SCADA API (/wecstd/range)        │
└───────────────────┬────────────────────────────────────────────┬───────────────────────┘
                    │                                            │
                    ▼ (Ingestion Script)                         ▼ (timescaleSyncJob.js - 12m)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              LOCAL TIMESCALEDB & REDIS DOCKER                          │
│                                                                                        │
│   • TimescaleDB (ace_timescaledb :5432)                                                │
│     - scada_10m hypertable (11,219 intervals across 78 days)                           │
│     - daily_rollup continuous aggregate (materialized daily totals)                    │
│     - dataset_downloads (HMAC token audit log)                                         │
│                                                                                        │
│   • Redis (ace_redis :6379, ~30 MB RAM)                                                │
│     - Hot telemetry cache (1s TTL)                                                     │
│     - Chat history per anonymous session id (30-min sliding TTL)                       │
│     - Rate limits (8 msgs / min per session, 30 / min per IP)                          │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                NODE.JS BACKEND ENGINE (:4100)                          │
│                                                                                        │
│   [1. Telemetry & Analytics APIs]                                                      │
│       • GET /api/history/records       -> All-time peaks, storms, best days             │
│       • GET /api/history/power-curve   -> 11,219 empirical points in 0.5m/s bins       │
│       • GET /api/history/compare       -> August vs. September generation comparison   │
│                                                                                        │
│   [2. Hybrid RAG Chat Agent (server/chat/agent.js & server/knowledge/knowledgeBase.js)]│
│       • Structured SQL Tools           -> Live speed, power, daily kWh, all records    │
│       • Markdown Knowledge RAG         -> BM25 over the fact sheet + repo docs         │
│       • Typo Tolerance                 -> Handles "yesterdat", "spining", slang        │
│       • Multi-Provider LLM Adapter     -> Claude Haiku, OpenAI, Groq, Gemini, or Local │
│       • Streaming                      -> POST /api/chat/stream (Server-Sent Events)   │
│                                                                                        │
│   [3. Researcher Dataset Delivery (server/datasetService.js)]                          │
│       • POST /api/datasets/request     -> Generates 24h HMAC-SHA256 signed token       │
│       • GET /api/datasets/download     -> Zero-copy kernel stream of 8.74 MB Parquet   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               FRONTEND DISPLAY SURFACES                                │
│                                                                                        │
│   • 🏘️ /screen/community : PBR turbine in the site scan, impact story, QR to chat      │
│   • 🎒 /screen/students  : Cartoon turbine, kid-friendly story, look-inside cutaway    │
│   • 🔬 /screen/college   : Blueprint turbine, live power curve, technical story        │
│   • 💬 /ask/:screen      : Private streaming phone chat opened from each screen's QR   │
│   • 🌐 / and /developers : Website and developer portal (endpoint explorer, datasets)  │
│   • 🎛️ /admin            : Wind simulator, scenarios, presets, screen remote, health   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 What Was Built: Step-by-Step Implementation Breakdown

### Step 1: Historical Analytical Backend (`server/db/timescaleDb.js`)
- **TimescaleDB Ingestion**: Ingested **11,219 ten-minute intervals** spanning July 21 to October 7, 2026 into the `scada_10m` hypertable, plus continuous aggregate `daily_rollup`.
- **Historical Endpoints Built**:
  - `GET /api/history/records`: Aggregates all-time records across the turbine's history:
    - **Peak active power**: `4,357 kW` (~4.36 MW) recorded on September 30.
    - **Max wind gust**: `22.1 m/s` (~79.5 km/h) recorded during September 4 storm.
    - **Best single day**: `76,239 kWh` on September 18 (operating at a `75.6%` capacity factor).
    - **Total clean generation**: Over `1.77 GWh` (~2,924 homes equivalent).
  - `GET /api/history/power-curve`: Bins all 11,219 intervals into 0.5 m/s wind speed increments with sample counts, min/max bounds, and average generation.
  - `GET /api/history/compare`: Performs month-over-month comparative analysis showing September generation was **+32.5%** over August due to stronger autumn Atlantic wind fronts.

### Step 2: Live Power Curve (`frontend/src/pages/screens/components/PowerCurvePanel.jsx`)
- **Empirical Power Curve Visualizer**: Overlays the Enercon E-115 reference curve (`shared/physics.js`) with the binned SCADA data points, on the College screen and in the admin console.
- **Live Operation Reticle**: Plots a pulsing marker showing the turbine's exact live position $(v_{\text{wind}}, P_{\text{active}})$ in real-time.
- **Story Panels**: The College screen pairs the curve with capacity utilisation, tip-speed ratio, daily energy bars and lifetime capacity factor.

### Step 3: Self-Hosted Redis Infrastructure (`server/db/redisClient.js`, `server/chat/historyStore.js`)
- **Zero-Cloud Redis**: Added `redis:7-alpine` (`ace_redis` on `127.0.0.1:6379`) to Docker Compose. Uses only **~30 MB of RAM**—no Upstash or Redis Cloud account needed.
- **Rate Limiter**: Limits chat requests to **8 messages per minute per session** and **30 per minute per IP**, plus one big-screen command per screen every 12 seconds.
- **Session Memory**: Stores multi-turn conversation history per anonymous session id with a **30-minute sliding TTL** (in-memory fallback without Redis).
- **1-Second Telemetry Cache**: Shields the database from high-frequency dashboard polling.

### Step 4: "Ask Ace" Phone Chat (`frontend/src/pages/ask/`)
- **QR, no login**: Each hoarding shows a QR to `/ask/<screen>`; the phone gets a server-signed anonymous session kept in `sessionStorage`, so two visitors never share a conversation.
- **Streaming**: Replies stream token by token over Server-Sent Events (`POST /api/chat/stream`), with tool status lines, typing dots and suggestion chips.
- **Remote control**: Visitors can open the turbine on the big screen they scanned; only a fixed action name is sent to the screen, never chat text.

### Step 5: Researcher Dataset Delivery Pipeline (`server/services/datasetService.js`)
- **Dataset Request Form**: On the `/developers` page, for university researchers, data scientists, and students.
- **Cryptographically Signed Links**: Generates **24-hour HMAC-SHA256 tokens** verifying requester email and dataset type without server-side link state.
- **Audit Logging**: Logs all dataset requests and download counts in the `dataset_downloads` table.
- **Zero-Copy Streaming**: Directly streams the verified 8.74 MB Parquet dataset (`ace-wind-2026-10m-latest.parquet`) to researchers via Node.js kernel streams.

### Step 6: Hybrid RAG Engine (`server/knowledge/knowledgeBase.js` & `server/chat/agent.js`)
- **Why Pure Vector RAG Fails for Turbines**: Vector embeddings cannot compute numbers, aggregate sensor intervals, or read live RPM.
- **The Hybrid Solution**:
  1. **Structured SQL Tools**: Query TimescaleDB directly for live telemetry, past 24-hour generation, records, and monthly comparisons.
  2. **Unstructured Document RAG**: BM25 search over a curated fact sheet (`server/knowledge/docs/weston-wind.md`) and the repo's Markdown docs (`DATA_SOURCES.md`, `API_REFERENCE.md`, `PROJECT_OVERVIEW.md`, etc.).
  3. **Typo Tolerance**: The offline intent router tolerates typos (e.g., *"how much did u generated yesterdat"* still triggers the 24-hour SCADA aggregation); the LLM handles them natively.
  4. **Multi-Provider LLM Integration**: Pre-wired for Anthropic Claude Haiku, OpenAI, Groq (Llama 3.3 70B), Google Gemini and any OpenAI-compatible endpoint, backed by a templated responder if external APIs are unavailable.

---

## 📊 Understanding the Data: Zenodo & Live API Reality

| Component | Source / File | Scope & Details |
| :--- | :--- | :--- |
| **10-Minute SCADA** | `ace-wind-2026-10m-latest.parquet` (8.7 MB) | **10,304 intervals** from July 21 to September 30, 2026. Contains wind speed, active power, RPM, pitch, nacelle yaw, and grid status. |
| **Daily Rollups** | `ace-wind-2026-daily-latest.parquet` (337 KB) | Pre-aggregated daily operational kWh, average power, and wind speed. |
| **Status Events** | `ace-wind-2026-events-latest.parquet` (325 KB) | Chronological operational status codes and DNO grid curtailment setpoints. |
| **Live Ingestion** | ACE DuckDNS API (`/wecstd/range`) | Automatically polls every 12 minutes to sync October 1 to present, maintaining **100% gapless continuous telemetry**. |

---

## 💰 Zero-Cloud-Cost Architecture Philosophy

Every component was intentionally designed to run self-hosted on an entry-level server (e.g. $5/month Contabo VPS) or a local kiosk PC:
- **No AWS S3 / Cloud Storage**: Parquet files are stored locally and served via streaming.
- **No Redis Cloud / Upstash**: Redis runs locally in Docker (30 MB RAM).
- **No Managed Vector Database (Pinecone / Weaviate)**: Semantic Markdown chunk index runs in-memory with sub-millisecond retrieval.
- **No External LLM Subscription Required**: Operates autonomously using grounded SQL tools, with optional zero-code hookups for Gemini or Groq.

---

## 📜 Attribution & Open Data

- Live Telemetry: [ACE Live API](https://ace-api.duckdns.org/docs) (OpenAPI 3.1.0, CC-BY-4.0).
- Historical Dataset: [ACE Wind Turbine Data on Zenodo](https://doi.org/10.5281/zenodo.22662372).

> Plumley, Charlie; Garrad, Andrew; Burke, Wilf; Jonsson, Christian; Smirthwaite, Andrew.  
> *ACE Wind Turbine Data.* Zenodo. https://doi.org/10.5281/zenodo.22662372  
> Published by Ambition Community Energy (ACE) under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).
