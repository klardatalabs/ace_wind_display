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
| `/site` | Cesium view of the ACE turbine at its real coordinates with Google Photorealistic 3D Tiles |
| `/developers` | Developer portal: live endpoint explorer, code samples, open-data downloads |
| `/screen/students` | Hoarding screen: kid-friendly story told over the live 3D place |
| `/screen/community` | Hoarding screen: the community story (homes powered, this week, since 2023) |
| `/screen/college` | Hoarding screen: spec, power curve, tip-speed ratio, generator, open data |
| `/ask/:screen` | Phone chat opened from each screen's QR code (no login) |

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
- Drag to orbit, pinch / wheel to zoom, double-tap to look inside, tap any item to read about it.

## Ask Ace — the phone chat

- Each browser tab gets an anonymous, **server-signed session token** (kept in `sessionStorage`).
  History is stored per session id only, so two visitors never see each other's messages, and a
  reload keeps the conversation.
- Replies **stream** over Server-Sent Events. The agent calls tools for live status, history,
  Tavily web search (the source for every non-live fact: the turbine, the project, the community, wind
  energy), `show_photos` (Unsplash), and `show_on_big_screen`, which sends a fixed animation name (never text) to the screen the visitor scanned.
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

## Real-world 3D site

The landing page has an opt-in site explorer; `/site` opens the larger view. Cesium streams Google Photorealistic 3D Tiles and loads `frontend/public/models/ace-turbine.glb` as a separate model. The guided `/screen/:screen` experience continues to use Three.js.

To enable the map without setting up Google billing, configure `VITE_CESIUM_ION_TOKEN` in the root `.env`. Enable Google Photorealistic 3D Tiles for the Cesium ion account and create a token with the required geocode and asset access. Restart Vite after changing it. Cesium's Community plan currently includes 1,000 Google Photorealistic 3D Tiles root requests per month and is limited to personal, non-commercial use. Check Cesium's [current pricing and licensing](https://cesium.com/platform/cesium-ion/pricing/) for your site's eligibility and usage.

An optional direct Google connection uses `VITE_GOOGLE_MAP_TILES_API_KEY` instead. That requires a Google Cloud project with billing, the Map Tiles API enabled, and a browser key restricted to your development and production website origins. Browser `VITE_*` values are public, so restrict keys in the provider console. Keep Google's map credits visible.

`VITE_SITE_LAT` and `VITE_SITE_LON` default to `51.5388355, -2.6717359`. The viewer samples Google's 3D surface near that point and uses the median height for the foundation. If the mesh does not give a reliable height, set a surveyed **ellipsoid height in metres** as `VITE_TURBINE_GROUND_HEIGHT_M`. `VITE_TURBINE_HEIGHT_OFFSET_M` adjusts that ground height; `VITE_TURBINE_HEADING_DEG` and `VITE_TURBINE_SCALE` control orientation and physical size. Verify all three against the live site before public launch. Google's source mesh may contain a captured turbine; inspect it from all directions to check for overlapping geometry.

Kiosk PC (one per hoarding):

```bash
chromium --kiosk --noerrdialogs --disable-session-crashed-bubble --incognito http://localhost:4100/screen/community
```

Set `PUBLIC_ORIGIN` to the public URL so the QR codes point phones at the right place.

## The place, the story and the walk-through

Every hoarding shows the same procedural 3D place around the turbine: terrain and shore, estate,
industrial units, a solar farm, pylons, hedges and woodland. The estate, units, solar farm and
pylons are **illustrations** (tapping them says so), not a survey.

- **Real time**: the sun is where it really is over Bristol (`frontend/src/three/environment.js`),
  and clouds, rain and haze follow OpenWeather at the site (`OPENWEATHER_API_KEY`). Windows light
  up at night in proportion to the homes the turbine is powering.
- **Story**: each screen plays chapters (`frontend/src/content/screens.js`): camera moves, drawn
  measurements, wind streamlines, a day time-lapse, and live figures that hang off the part of the
  scene they describe (blade tip, nacelle, homes).
- **Walk inside**: a first-person climb through the tower door, up the ladder and through the hatch
  into the machine room. A phone can start it and scrub it with a slider ("Walk inside").
- **Tap anything** (the blades, nacelle, tower, track, estate, the sky) for a description card; "Ask
  Ace more" fetches a fuller answer with photos through the chatbot.

## Chat sources

Ace answers live questions from the turbine's own data tools. Facts about the turbine, the project
and the area come from a **web search** (Tavily, `TAVILY_API_KEY`), not from local documents, and
photos come from **Unsplash** (`UNSPLASH_ACCESS_KEY`), always with the photographer's credit.

## Demo and simulation API

There is no admin page. For demos and testing, `/api/admin/*` can still drive every screen
(protect it with `ADMIN_TOKEN`, or leave `NODE_ENV` unset for local use): simulate wind speed and
bearing, apply presets, force the time of day, cloud, rain and fog (`/api/admin/environment`),
and send commands to a connected screen. `npm run check:api` tests every endpoint.

## Project layout

```
server/            Express API, WebSocket hub, chat agent, data jobs
  chat/            sessions, history store, agent loop, LLM providers, tools, personas
  routes/          state, history, datasets, chat (SSE), screens, environment, photos, admin (demo API)
shared/            constants, impact maths and turbine physics used by server and frontend
frontend/          Vite + React + Tailwind v4 + GSAP
  src/three/       TurbineScene, camera rig, world (terrain, trees, buildings), sky, walk, hotspots
  src/pages/       landing, developers, screens, ask
assets/source/     the turbine in .blend / .glb / .fbx / .obj
scripts/           GLB export, Zenodo ingest, landing-page 3D stills (render-stills.mjs)
```

The 3D stills on the landing page are rendered from the real scene with
`npm run render:stills` (server running, Playwright installed).

## Maintained TimescaleDB history

See [HISTORY_RUNBOOK.md](docs/HISTORY_RUNBOOK.md) for the data requirements,
canonical table, API/monthly Zenodo ingestion, CSV/Grafana, backup/restore,
presentation-safe migration and rollback.

`HISTORY_BACKEND=legacy` preserves existing readers until acceptance after the
28 October 2026 presentation. The explicit canonical migration does not run on
startup and does not destroy the legacy tables. Never reset an existing Docker
volume to upgrade. `scripts/ingest_zenodo.py` is a legacy SQLite utility;
`npm run history:zenodo` maintains canonical archive imports.

Data: [ACE API](https://ace-api.duckdns.org/docs) and
[ACE Wind Turbine Data on Zenodo](https://doi.org/10.5281/zenodo.22662372), CC-BY-4.0.
