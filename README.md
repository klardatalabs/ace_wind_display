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

## 📜 Attribution & Open Data

- Live Telemetry: [ACE Live API](https://ace-api.duckdns.org/docs) (OpenAPI 3.1.0, CC-BY-4.0).
- Historical Dataset: [ACE Wind Turbine Data on Zenodo](https://doi.org/10.5281/zenodo.22662372).

> Plumley, Charlie; Garrad, Andrew; Burke, Wilf; Jonsson, Christian; Smirthwaite, Andrew.  
> *ACE Wind Turbine Data.* Zenodo. https://doi.org/10.5281/zenodo.22662372  
> Published by Ambition Community Energy (ACE) under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).
