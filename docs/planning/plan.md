# Lawrence Weston wind final release plan

**Planning date:** 25 October 2026 (IST)
**Discussion:** Monday, 26 October 2026
**Target release:** Wednesday, 28 October 2026
**Scope:** Production-ready screens, research chat, seasonal wind view, news, and public repository review. Implementation was authorised on 25 October in `codex/final-presentation-release`; deployment and public sharing remain separate release steps.

## Decisions made

- Aim for a production-ready release, not a presentation-only mockup.
- "IP" means patents and other intellectual-property documents. Use a reviewed, legally reusable research set with citations.
- The app selects relevant, recent news automatically. No per-article human approval is required. The feed must have a controlled source list, relevance rules, attribution, duplicate detection, and a safe stale/empty state.
- Put the four-season wind comparison on the College screen and link to it from the website. Base it on measured history and disclose coverage or proxy measurements.
- Discuss on Monday; no reminder. The public GitHub destination (personal fork or organisation) will be decided later, before publication.

## Baseline recorded before this branch's changes

- `frontend/src/pages/screens/ScreenPage.jsx` and `frontend/src/three/TurbineScene.js` drive the kiosk scenes. `ScreenTopBar.jsx` has full-screen control but no home control; `ChatHeader.jsx` has New chat but no close/home control.
- The College `AskDemo.jsx` is scripted. The phone chat already has document ingestion, hybrid retrieval, and an evaluation script. `knowledgeSearch.js` and the agent currently describe sources as books and do not provide source links in answers.
- TimescaleDB stores site wind direction and speed, and the archive stores turbine wind speed and nacelle position. No four-season comparison service or chart exists. Data coverage must be measured before deciding how to represent each season.
- There is no News route or feed job. A new collector path should follow the existing job/API/cache pattern.
- `.github/workflows/deploy.yml` deploys pushes to `main`; public repository work and production deployment must therefore be coordinated. `.env`, `data/`, and `ingestion/` are ignored in the current checkout; history and asset rights still need review.

## Work order

### 1. Establish the release baseline (Monday)

- Capture current screen, live explorer, chat, and website views at target kiosk and phone sizes; record rendering and overlap defects with screenshots.
- Run existing server/frontend tests and production build. Record existing failures separately from new ones.
- Check the usable date range and completeness of site wind observations, archive wind speed, and nacelle positions. Choose a truthful four-season representation before coding.
- Confirm news sources/feed formats and the research source shortlist; verify publication dates, licences, and original URLs. Treat the Shanghai underwater datacentre claim as a candidate story until independently verified.

**Gate:** Monday discussion agrees on screen examples, research source shortlist, seasonal data method, and news source list. Confirm which GitHub remote will eventually be public.

### 2. Fix core screen presentation and navigation

- Correct the recorded object rendering defects in the shared scene/component code. Fix captions, labels, QR cards, and panel overlap at the tested aspect ratios without hiding required information.
- Add visible Home/Back controls to kiosk and live explorer views. Add Close chat/Home to the phone chat while keeping New chat a separate action. Ensure keyboard and touch access and sensible full-screen exit behaviour.
- Verify every screen chapter and navigation route at kiosk and phone sizes; check reduced-motion and missing-live-data states.

**Done when:** no recorded overlap or missing-object defect remains; each view has an obvious route home; chat navigation does not unexpectedly erase a session.

### 3. Extend research retrieval and College examples

- Build a small manifest of open-access university-level books, papers, and patents: title, author/institution, date, original URL or DOI/patent identifier, licence, and intended topic. Keep copyrighted full texts out of the public repository.
- Reuse the existing PDF/DOCX ingestion path. Add only the metadata needed to give visitors a usable, verifiable citation; adapt `search_books` naming and College guidance to cover papers and patents.
- Update the College scripted chat example and phone suggestions with one or more explicit "what if" analyses. Separate observed ACE measurements from assumptions and calculated scenarios; show supporting sources.
- Extend retrieval evaluation with representative research and patent questions. Verify citation correctness and a safe answer when no source is found.

**Done when:** research questions retrieve relevant passages, the user can identify their sources, and the what-if example labels its assumptions.

### 4. Show seasonal wind patterns

- Aggregate measured data into UK meteorological seasons (winter, spring, summer, autumn), using a complete-year comparison where coverage permits. Show sample counts/date range and gaps.
- Present a readable comparison of wind speed and direction on the College screen, with a website link. If historical direction must come from nacelle position, label it as a proxy; never present incomplete data as a measured four-season pattern.
- Test season boundaries, partial years, missing data, and performance of the aggregation endpoint.

**Done when:** all four seasons are represented honestly, and users can see the basis and coverage of the comparison.

### 5. Add an automatically curated live News view

- Ingest from a short approved list of reliable original publishers or feeds. Select stories about wind, clean energy, energy for AI/data centres, and credible future applications using explicit relevance rules; reject duplicates, old items, and unsupported claims.
- Cache and serve title, short original summary, publisher, publication date, source link, and last update time. Refresh on a schedule with rate limits and failure handling; keep the last verified set if feeds fail, visibly marked stale.
- Show one rotating headline at a time in the upper-right of the Community and College screens, with publisher, date, and a stale/empty state. Leave the Students screen without news. The website News link opens the Community screen. Keep the card clear of 3D labels. Use the Shanghai story only if its original source, date, and claim are verified.
- Test filtering, duplicate handling, bad feed data, source failures, and empty/stale presentation.

**Done when:** the app automatically shows only on-topic, attributed items and remains usable when providers fail.

### 6. Review and release (Tuesday–Wednesday)

- Review the diff and whole-repository risks, run CI/test/build/retrieval checks, and perform a manual kiosk/phone walkthrough. Check loading, API failures, stale data, accessibility, and performance on the target hardware.
- Audit tracked files **and Git history** for secrets, private data, large archives, unlicensed assets, and documents. Add attribution/licensing and a reproducible setup guide before any public share.
- Confirm the chosen public remote and ownership. Coordinate the merge because pushes to `main` deploy automatically. Check migration/backup/rollback path, deploy, then verify health endpoints, key routes, chat, seasonal view, and news from the public site.
- Share the repository publicly only after the audit passes and the remote is confirmed.

**Release gate:** All required flows work, tests/build pass, content and provenance checks pass, the target screens are visually checked, deployment is healthy, and there are no unresolved secret or licence findings. If the gate fails on Wednesday, report the blocker and do not claim a production-ready release.

## Main risks and decisions for Monday

- **Schedule:** Three days for visual repair, new data views, new feed infrastructure, source curation, audit, and production checks is tight. Use Monday to rank must-show screens and select the smallest credible source/feed set without weakening the release gate.
- **Seasonal data:** Wind-direction history may be short; archive nacelle position is a proxy. Agree on labelling or an additional authoritative source if coverage is insufficient.
- **Automated news:** Automatic relevance selection can surface a wrong or outdated story. Start with few approved sources and deterministic filters; display freshness and source links.
- **Public repository:** Decide fork versus organisation before changing visibility. A clean working tree and `.gitignore` are not enough; history and rights must pass review.

## Verification commands already in the repository

- Backend: `npm test`
- Frontend build: `npm --prefix frontend run build`
- Frontend tests: `cd frontend/src && node --test "three/*.test.mjs" "cesium/*.test.mjs"`
- Retrieval evaluation, with a populated knowledge database: `npm run knowledge:eval`

No reboot of the shared server is part of this plan.

## Monday update: news expansion and remaining research work

The Community and College screens now have an in-screen rotating news card; Students does not. The feed reads four publishers (EIA, U.S. DOE, UK DESNZ, and Carbon Brief) and selects up to eight recent, relevant stories. The server checks publishers every 15 minutes and the card checks the app API every minute. This is a live, automatically refreshed feed, but a new headline appears only when a publisher releases a qualifying story. Verify both card placements in the local preview and again after deployment.

### Research chat: next implementation slices

1. **Curate the corpus.** Check the five existing source records and add a focused set of university-level material on wind resource assessment, turbine aerodynamics, wake/spacing effects, generators and control, grid integration, and storage. Include original papers, openly available books/chapters, and published patent specifications. Record author, date, DOI/patent number, original URL, and reuse terms. Mark patent claims as descriptions of inventions, never proof of what the ACE turbine contains.
2. **Load and cite it.** Run the existing curated ingestion into a staging knowledge database, inspect extracted text and page boundaries, then add reviewed sources in small batches. Keep downloaded documents out of Git. Show title, author/publisher, year, page or section, and original link with each chat answer. Say when retrieval finds no reliable passage.
3. **Make the College example useful.** Put source-backed example questions in the College chat mockup: e.g. "What changes if average wind speed rises 10%?", "How do turbine wakes affect spacing?", and "How does a direct-drive generator compare with a geared design?" Label scenario inputs and calculated outcomes; keep observed ACE values separate from hypothetical results.
4. **Evaluate before release.** Run research/patent question sets against the populated staging corpus. Check source relevance, citation accuracy, no-source behavior, and that patent text is not presented as site-specific fact. Include at least one what-if question with independently checked arithmetic.

### Four-season wind comparison: next implementation slices

1. Query the production data *read-only* for each season's date range, ten-minute sample coverage, speed range, and direction availability. Use UK meteorological seasons: winter Dec–Feb, spring Mar–May, summer Jun–Aug, autumn Sep–Nov. Choose the latest complete four-season year only if data coverage supports it.
2. Keep the existing seasonal API and deeper College-linked view, then add a compact four-season comparison on the College screen itself; the website link opens the detailed comparison. Show all four seasons together, with a consistent speed scale, directional distribution, and visible coverage/date labels.
3. Use measured wind direction if the historical source actually provides it. Otherwise label nacelle heading as a direction proxy. If a season lacks sufficient observations, show "insufficient data" instead of an inferred pattern.
4. Check season boundaries, gaps, query time, and readability at kiosk and mobile sizes; compare aggregate totals with direct database queries before the Wednesday release gate.

The remaining RAG ingestion and seasonal-data checks require access to the intended database and actual site history. Code and local previews alone cannot establish that those production views are ready.

### Research library drawer

The Ask Ace phone chat has a top-left Library button. It opens a sliding drawer with animated book volumes, research files, and patent files. The public catalogue combines the reviewed ingestion shortlist with further-reading links; it labels a source "Searchable in chat" only when the knowledge database reports extracted passages. Additional books and papers should enter the reviewed source list as the RAG corpus grows. Verify the drawer on a phone, test keyboard Escape/close and reduced-motion behavior, and compare its readiness labels with the populated database before release.

After review, the broad University Physics title was removed in favour of the U.S. Department of Energy's wind-specific guide. The wind-speed what-if answer now shows its speed-cubed calculation and links to that guide. Keep checking future additions for direct relevance to wind-energy research.

## Proposed next feature: research-backed What-if Studio in Ask Ace (26 October)

**Goal.** Visitors type natural-language changes through a `+` beside the chat composer, see the ACE turbine respond in a 3D scene, and compare a clearly identified baseline with a hypothetical outcome. The interface keeps its chat-first feel; parameter controls are available in an expandable inspector, not a mandatory form. The first four-input Studio is implemented locally; it is not a validated engineering simulator. Data-audit, ingestion, and device-review tasks remain below.

### Evidence and parameter inventory first

- Treat the ACE dataset's static, configuration, event, 10-minute, 60-second, and approximately one-second files as the first source to inspect. Build a field dictionary with units, timestamps, sampling, quality, range, provenance, and licensing. Compare it with the live API, current ingest schema, and the exact E-115 EP3 variant at Lawrence Weston.
- The **current app integration** already has active power, wind speed, wind direction, rotor speed, nacelle angle, exported energy, operating hours, and operating/fault status, with some fields optional. It does not currently ingest blade pitch, vibration, component temperature, bearing load, or torque. Inspect ACE configuration and source documentation before declaring any of these measured or using them as defaults.
- Audit `shared/physics.js` against traceable ACE/manufacturer data. Its RPM and power curve are presently labelled as assumptions/reference behavior in code. The application must not call them a verified ACE prediction unless their source, variant, and operating conditions are established.
- Build a parameter registry. Each field has unit, baseline source (`live`, `historical`, `ACE configuration`, `manufacturer`, or `assumed`), freshness, editable bounds, calculation support, and a corresponding 3D/graph effect. Baseline choice: a timestamped live snapshot when healthy, otherwise a selected historical interval or explicitly labelled reference values. Missing readings never silently become live values.

### Interaction and calculation design

1. Add `+` at the Ask Ace composer. It opens a sliding **What-if Studio** with one free-form prompt, example prompts, a compact 3D ACE turbine, and a baseline selector. Suggested prompt: “What if wind rises from 7 to 9 m/s for an hour and the grid limit stays the same?” The chat response shows the changed inputs, baseline and scenario outputs, source links, assumptions, uncertainty, and a Reset/Undo action.
2. Parse the user's text into a typed scenario proposal. Show the interpretation in plain language and allow direct correction. Keep an expandable **All parameters** inspector grouped by weather, turbine/rotor, generator/control, and grid; populate fields from the registry rather than asking users to fill a form first. Preserve units and reject impossible or ambiguous combinations before calculation.
3. Keep the language/retrieval layer separate from the calculation engine. RAG locates evidence for explanations and assumptions; versioned deterministic functions calculate power/energy. A model may propose a scenario but cannot invent a sensor reading or numeric result. Store the baseline timestamp, input values, formula/model version, and cited sources with each result.
4. Reuse the existing `TurbineScene` and its `setLive`/`setEnvironment` hooks for a lightweight, interactive view in chat. Wind-speed scenarios animate rotor speed smoothly; wind direction changes yaw/wind visualization; weather changes the scene. Pitch or internal parts animate only if the model supports an honest depiction. Other inputs update charts/annotations without suggesting the 3D mesh is a physics simulation. Load this view on opening Studio without blocking chat or repeating the screen's expensive full-scene initialization.
5. Implement calculation tiers. **First:** teaching examples and instant visuals with explicit assumptions and cut-in/rated/storm limits. **Next:** site-calibrated power/energy estimates from a validated ACE curve and historical samples, including sample coverage and uncertainty. **Later:** pitch, aerodynamic loads, component temperatures, and design changes only after suitable OEM/validated engineering model inputs exist. Unsupported requests receive a useful explanation and sources, rather than a fabricated number. Scenarios never write to turbine controls or live telemetry.

### Research corpus and answer quality

- Add a reviewed, wind-specific corpus: ACE data and metadata; NREL/AWS *Wind Resource Assessment Handbook*; NREL *Fundamentals of Wind Energy*; Lee et al., *The Power Curve Working Group's assessment of wind turbine power performance prediction methods*; IEA Wind power-performance guidance; OpenFAST/AeroDyn documentation as a modelling reference; selected E-115 EP3 technical material and relevant patent specifications. Check rights and the exact turbine variant before ingesting or exposing full text. Reference-turbine studies must be labelled as general research, not ACE specifications.
- For each document, record persistent URL/DOI, edition, author, date, licence, topic, extraction quality, and page/section anchors. Ingest in reviewed batches, inspect extracted passages, then run retrieval questions covering fundamentals, ACE facts, control, power curves, uncertainty, and patents. Cite original passages in answers and distinguish evidence, calculation, and assumption.
- Keep the Library drawer synchronized with actually indexed documents. Show searchable state only after ingestion succeeds. University students can browse all public references; patent claims are inventions, not proof of installed ACE hardware.

### Delivery slices and checks

1. **Source audit and design gate:** ACE field dictionary, exact E-115 variant, power-curve provenance, research shortlist, input/output matrix, and unsupported-parameter list reviewed. No full engineering output promised until this gate passes.
2. **Chat-first vertical slice:** `+` opens Studio; natural-language wind-speed/period change is parsed, editable, resettable; baseline and scenario results are traceable; rotor animation responds; small screens and keyboard work.
3. **Research-backed slice:** more wind-specific sources indexed, passages/citations verified, library readiness truthful, no-source handling tested, and explanations link to the calculation method.
4. **Validated scenario slice:** ACE-calibrated power and energy with caps/operating states, comparison chart, time-series scenarios, uncertainty and coverage labels. Extend the parameter inspector only to inputs supported by the chosen model.
5. **Advanced engineering slice:** evaluate OpenFAST/AeroDyn or a validated equivalent for pitch, yaw losses, loads, and design changes after acquiring turbine-specific inputs and expert validation. Keep this separate from the initial public calculator.

**Acceptance checks:** compare scenario arithmetic with independent calculations; test units, limits, cut-in/rated/cut-out, stale/missing data, and invalid combinations; test retrieval and citation grounding; measure chat/3D open time and frame continuity on target phones; ensure scenarios cannot reach control APIs. The full editable engineering twin is a separate milestone from the existing Wednesday release gate; its date depends on ACE data availability and model validation.
