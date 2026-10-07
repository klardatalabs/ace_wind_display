# ACE Wind Turbine — Public Community Hoarding & Digital Billboard

*Live Wind. Local Energy. Community Impact.*

A high-aesthetic, zero-clutter digital hoarding display designed for the public screen in the **Ambition Lawrence Weston Community Centre**, Bristol, UK.

Built for the WeDoWind "ACE Wind Turbine Public Display" open-data challenge (see [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)).

---

## 🌟 What It Delivers

### 1. 🏘️ Community Hoarding Screen (`/community.html`)
- **Real Photographic Landscapes:** Seamlessly switchable between the lush rolling green meadow under deep blue skies (`green-hills.jpg`) and the authentic Lawrence Weston / Avonmouth aerial drone photograph overlooking the Severn Estuary (`ace-real-drone.jpg`). Toggle via the top-bar pill or simply press **`B`**.
- **Authentic 3D Blender Model Integration (`ACE_Turbine.blend`):** Exported directly to a WebGL glTF 2.0 binary (`ace_turbine.glb`) and rendered using **Three.js with Physically Based Rendering (PBR)**:
  - Exact 1:1 architectural scale: 89m hub height, 56m blade radius, 150m tip height.
  - Full authentic hierarchy preserved: `RotorSpin` (blades, spinner dome, generator rotor), `Yaw` (nacelle housing, roof sensors, aviation beacon), and tower with authentic Enercon green base rings, concrete foundation, and transformer sub-station.
  - Realistic daylight sunlight illumination with soft dynamic shadow mapping.
  - Smooth 60 FPS sub-pixel blade rotation tied to live or simulated telemetry RPM, with realistic physical momentum.
  - **Interactive 3D Orbit Camera:** Drag to orbit and inspect from any angle, scroll to zoom, double-click to reset to the cinematic hero angle.
- **Billboard-First Philosophy:** High-contrast frosted glass cards with zero engineering jargon — completely readable from across a room.
- **8-Second Rotating Narrative:** Seamlessly transitions between human-centric beats:
  1. *Live Power & Lawrence Weston Homes Powered* (e.g. `2,840 Homes`)
  2. *Live Coastal Weather & Beaufort Scale*
  3. *Today's Clean MWh Generated*
  4. *Avoided Carbon Pollution ($CO_2$ kg & Equivalent Trees)*
  5. *Community Prosperity Fund (Estimated £ for ALW warm hubs & fuel poverty support)*
  6. *All-time Clean Energy Generation since 2023 Commissioning*

### 2. 🎒 Schools & Youth Screen (`/schools.html`)
- **Reactive Cartoon Turbine Character:** Inspired directly by the project reference design (`cartoon-windmill-smiling-face...`).
- **Dynamic Physics & Facial Expressions:**
  - 😴 **Dead Calm ($< 2.5$ m/s):** Eyes close into sleepy lines, soft floating `"Zzz..."` bubble appears, blades rest.
  - 😊 **Normal Generation ($2.5 - 12.5$ m/s):** Big joyful smile, cute natural blinks, blades spinning enthusiastically.
  - 💨 **High Gale & Violent Wind ($> 13$ m/s):** **Tower physically bends and leans with wind gusts**, eyes squeezed tightly shut against the blast, wind gust swoosh lines!
  - 🌪️ **Storm Cut-Out ($> 28$ m/s):** Blades feather sideways to stay safe, dizzy expression.
  - 🔧 **Maintenance Mode:** Cute worker hard-hat / wrench icon.
- **Kid-Friendly Story Comparisons:**
  - *Blade tip speed vs. the fastest cheetah on Earth (up to 180 mph!)*
  - *Sweeping an area bigger than 1.5 Premier League football pitches every turn!*
  - *Generating enough power to run 12,000 video game consoles or boil 1,500 kettles at once!*
  - *Taller than the London Eye (135m) and Big Ben (96m)!*

### 3. 🔬 Data Science & University Screen (`/datascience.html`)
- **Live IEC 61400-25 SCADA Telemetry:** Capacity factor %, rated vs actual power, curtailment setpoint monitoring.
- **Live Enercon E-115 Power Curve Canvas:** Real-time scatter points and theoretical power curve overlaid with a pulsing live operational target reticle.
- **Live Nacelle Azimuth Compass Rose:** Compass needle showing nacelle yaw orientation angle.

### 4. 🎛️ Operator & Demo Simulator Deck (`/admin.html`)
- **1-Click Demo Scenarios:**
  - 💤 **Dead Calm** (Wind 1.2 m/s, Power 0 kW, RPM 0.2 — Nap mode)
  - 🍃 **Gentle Breeze** (Wind 5.5 m/s, Power 650 kW, RPM 6.8 — Generating)
  - 🐆 **Cheetah Mode / Peak 4.2 MW** (Wind 12.8 m/s, Power 4,200 kW, RPM 13.5 — Top speed)
  - 🌪️ **Violent Gale & Cut-Out** (Wind 29.5 m/s, Power 0 kW, RPM 0.8 — Bent tower, feathered blades)
  - 🛑 **Grid Curtailment** (Wind 11.0 m/s, Power 1,500 kW — Throttled by DNO)
  - 🔧 **Maintenance** (Service flag active, technicians on site)
  - ⚠️ **Safety Trip / Fault**
- **Granular Manual Sliders:** Wind Speed ($0 - 35$ m/s), Active Power ($0 - 4,245$ kW), Rotor RPM ($0 - 15$ rpm), Nacelle Yaw ($0 - 360^\circ$).
- **Live Broadcast Inspector:** Real-time JSON and metrics monitor showing the exact payload pushed over WebSocket to all screens.
- **"Resume Live Telemetry" Button:** Instantly snaps back to polling the real ACE duckdns API.

---

## ⚡ Effortless Display Switching

Even though there are no buttons on the hoarding screens, switching during testing and demos is simple:
1. **Keyboard Shortcuts:**
   - Press **`1`** → Switch to Community Screen
   - Press **`2`** → Switch to Schools Screen
   - Press **`3`** → Switch to Data Science Screen
   - Press **`A`** or **`0`** → Switch to Admin Portal
   - Press **`F`** → Toggle Fullscreen
2. **Hidden Hot-Corner Hover:**
   - Move your mouse to the **top-right corner** of any screen to reveal a floating, translucent glass switcher.
3. **Admin Launch Bar:**
   - One-click launcher links at the top of `/admin.html`.

---

## 🚀 Running Locally

### 1. Start the Backend Server
```bash
npm start
```
*(Runs on port 4100 by default, or specify `PORT=8080 npm start`)*

### 2. Open Any Screen in Your Browser
- **Community (Default):** [http://localhost:4100/community.html](http://localhost:4100/community.html)
- **Schools (Cartoon):** [http://localhost:4100/schools.html](http://localhost:4100/schools.html)
- **Data Science:** [http://localhost:4100/datascience.html](http://localhost:4100/datascience.html)
- **Admin Simulator:** [http://localhost:4100/admin.html](http://localhost:4100/admin.html)

---

## 🖥️ Deploying to the Community Centre Kiosk PC

On the kiosk PC connected to the public display:
```bash
chromium --kiosk --noerrdialogs --disable-session-crashed-bubble --incognito http://localhost:4100/community.html
```

---

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
- When the backend starts (`npm start`), the sync job runs immediately and on a recurring 12-minute schedule.
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
│     - User chat session memory (20-min TTL)                                            │
│     - Sliding-window rate limiter (6 msgs / 60s)                                       │
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
│   [2. Hybrid RAG Conversational Engine (server/aiAgent.js & server/ragKnowledge.js)]   │
│       • Structured SQL Tools           -> Live speed, power, daily kWh, all records    │
│       • Markdown Knowledge RAG         -> 158 chunks indexed from repo docs (specs)    │
│       • Typo Tolerance                 -> Handles "yesterdat", "spining", slang        │
│       • Multi-Provider LLM Adapter     -> Google Gemini, Groq (Llama 3.3), or Local    │
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
│   • 🏘️ /community.html   : Three.js 3D PBR turbine, rotating impact story, AI chat     │
│   • 🎒 /schools.html     : Reactive cartoon turbine with dynamic expressions & physics │
│   • 🔬 /datascience.html : Canvas power curve, live records, dataset download modal    │
│   • 🎛️ /admin.html       : 1-click scenario simulator, manual sliders, API inspector   │
│   • 💬 Chat Widget       : Floating "Ask the Turbine" assistant on all public pages    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 What Was Built: Step-by-Step Implementation Breakdown

### Step 1: Historical Analytical Backend (`server/timescaleDb.js`)
- **TimescaleDB Ingestion**: Ingested **11,219 ten-minute intervals** spanning July 21 to October 7, 2026 into the `scada_10m` hypertable, plus continuous aggregate `daily_rollup`.
- **Historical Endpoints Built**:
  - `GET /api/history/records`: Aggregates all-time records across the turbine's history:
    - **Peak active power**: `4,357 kW` (~4.36 MW) recorded on September 30.
    - **Max wind gust**: `22.1 m/s` (~79.5 km/h) recorded during September 4 storm.
    - **Best single day**: `76,239 kWh` on September 18 (operating at a `75.6%` capacity factor).
    - **Total clean generation**: Over `1.77 GWh` (~2,924 homes equivalent).
  - `GET /api/history/power-curve`: Bins all 11,219 intervals into 0.5 m/s wind speed increments with sample counts, min/max bounds, and average generation.
  - `GET /api/history/compare`: Performs month-over-month comparative analysis showing September generation was **+32.5%** over August due to stronger autumn Atlantic wind fronts.

### Step 2: Frontend Data Science & Power Curve Canvas (`public/js/datascience.js`)
- **Empirical Power Curve Visualizer**: Overlays theoretical Enercon E-115 power curve with **11,219 real binned SCADA data points** rendered on an HTML5 `<canvas>`.
- **Live Operation Reticle**: Plots a pulsating cyan marker showing the turbine's exact live position $(v_{\text{wind}}, P_{\text{active}})$ in real-time.
- **Dynamic KPI Cards**: Displays all-time peak power, max wind, best generation day, and autumn delta percentage.

### Step 3: Self-Hosted Redis Infrastructure (`server/redisClient.js`)
- **Zero-Cloud Redis**: Added `redis:7-alpine` (`ace_redis` on `127.0.0.1:6379`) to Docker Compose. Uses only **~30 MB of RAM**—no Upstash or Redis Cloud account needed.
- **Sliding-Window Rate Limiter**: Limits chat requests to **6 messages per 60 seconds** per session using atomic Redis Lua transaction scripts.
- **Session Memory**: Stores multi-turn conversation history per session with a **20-minute sliding TTL**.
- **1-Second Telemetry Cache**: Shields the database from high-frequency dashboard polling.

### Step 4: Floating "Ask the Turbine" Chat Widget (`public/js/chat-widget.js`)
- **Kiosk-Optimized UI**: Built a floating glassmorphism widget with a glowing turbine badge, quick-suggestion prompt pills, animated typing indicator, and smooth auto-scrolling.
- **Embedded Everywhere**: Active on `/community.html`, `/datascience.html`, and `/schools.html`.
- **Dual Transport**: Communicates seamlessly over WebSocket (`chat.send`) with automatic REST fallback (`POST /api/chat`).

### Step 5: Researcher Dataset Delivery Pipeline (`server/datasetService.js`)
- **Dataset Request Modal**: Added a clean modal on `/datascience.html` for university researchers, data scientists, and students.
- **Cryptographically Signed Links**: Generates **24-hour HMAC-SHA256 tokens** verifying requester email and dataset type without server-side link state.
- **Audit Logging**: Logs all dataset requests and download counts in the `dataset_downloads` table.
- **Zero-Copy Streaming**: Directly streams the verified 8.74 MB Parquet dataset (`ace-wind-2026-10m-latest.parquet`) to researchers via Node.js kernel streams.

### Step 6: Hybrid RAG Engine (`server/ragKnowledge.js` & `server/aiAgent.js`)
- **Why Pure Vector RAG Fails for Turbines**: Vector embeddings cannot compute numbers, aggregate sensor intervals, or read live RPM.
- **The Hybrid Solution**:
  1. **Structured SQL Tools**: Query TimescaleDB directly for live telemetry, past 24-hour generation, records, and monthly comparisons.
  2. **Unstructured Document RAG**: Chunks and indexes **158 semantic sections** across 8 Markdown files (`DATA_SOURCES.md`, `API_REFERENCE.md`, `PUBLIC_EXPERIENCE_BLUEPRINT.md`, `SYSTEM_DESIGN.md`, etc.).
  3. **Typo Tolerance**: Normalizes user typos (e.g., *"how much did u generated yesterdat"* correctly triggers the continuous 24-hour SCADA aggregation).
  4. **Multi-Provider LLM Integration**: Pre-wired for Google Gemini, Groq (Llama 3.3 70B), and OpenAI, backed by a local synthesis engine if external APIs are unavailable.

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
