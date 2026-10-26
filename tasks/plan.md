# Weston Wind final release plan

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

## Existing foundation and gaps

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
- Show one rotating headline at a time in the upper-right of the Community screen, with publisher, date, and a stale/empty state. The website News link opens that screen. Keep the card clear of 3D labels. Use the Shanghai story only if its original source, date, and claim are verified.
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

The Community screen already has an in-screen rotating news card. The feed now reads four publishers (EIA, U.S. DOE, UK DESNZ, and Carbon Brief) and selects up to eight recent, relevant stories. The server will check publishers every 15 minutes and the card will check the app API every minute. This is a live, automatically refreshed feed, but a new headline appears only when a publisher releases a qualifying story. Verify the expanded card in the local preview and again after deployment.

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
