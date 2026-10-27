# Lawrence Weston wind release tasks

Target: Wednesday, 28 October 2026. Monday, 26 October is the decision review.

## Monday: baseline and decisions

- [ ] Capture target-size screenshots and list specific rendering/overlap failures.
- [x] Run baseline tests and build.
- [ ] Measure seasonal data coverage against the production database.
- [ ] Approve initial research corpus and news source list; confirm seasonal labelling.
- [ ] Choose personal or organisation remote before public publication.

## Implementation

- [ ] Verify scene rendering and screen text/panel collisions in a reachable browser at kiosk and phone sizes.
- [x] Add Home and Close chat navigation; preserve chat unless New chat is chosen.
- [ ] Run the curated book, paper, and patent ingestion against the production knowledge database and verify retrieval.
- [x] Add College what-if examples and source-aware research answers.
- [ ] Extend retrieval evaluation and run it against the populated database.
- [x] Add seasonal aggregation and College view with coverage/proxy labels and website link.
- [x] Add automatically selected, attributed news with filtering, freshness, and fallback states.
- [x] Put rotating news in the Community screen and remove the separate News page.
- [x] Show the same rotating news on College; keep Students free of news.
- [x] Explain the wind-speed what-if arithmetic and replace the general physics book with a wind guide.
- [x] Expand the live news sources and increase source checks to every 15 minutes.
- [x] Verify the local preview API serves eight automatically selected stories; visual card review remains pending.
- [ ] Check the expanded in-screen card visually and again after deployment.
- [ ] Review and add university-level wind papers, books/chapters, and patent documents to the source manifest.
- [ ] Ingest reviewed sources into staging; inspect text and citation metadata.
- [ ] Add source-backed College what-if, wake, and generator examples; evaluate answers against the populated corpus.
- [x] Add the sliding Ask Ace research library with bookshelf, paper and patent files, and source links.
- [ ] Verify library animation, mobile layout, keyboard controls, and source-readiness labels against the populated database.
- [ ] Measure four-season coverage and direction availability from the actual site history.
- [ ] Put a compact four-season comparison on the College screen, with the existing detailed view linked from the website.
- [x] Delay the heavy real-world viewer until its preceding chapter and fix the invalid rain graphic.
- [x] Replace delayed interior warm-up with complete shader preparation before the story starts after an observed mid-animation pause.
- [x] Provide an isolated local preview chat session and sample answers so the chat UI can be reviewed without production databases.
- [ ] Check the interior transition on target hardware for frame stalls; inspect GPU timing if a pause remains.

## Wednesday release gate

- [ ] Pass server tests, frontend tests/build, retrieval checks, and visual/device walkthrough.
- [ ] Review repository and Git history for secrets, private data, licensing, and attribution.
- [ ] Verify deployment, rollback, and public-site health without disturbing other server workloads.
- [ ] Publish the chosen repository only after the audit passes and the remote is confirmed.

## What-if Studio and expanded research RAG

- [x] Document fields currently ingested from ACE and distinguish them from uninspected archive configuration fields.
- [ ] Inspect the complete ACE configuration/SCADA/OPC archive field list and confirm any additional sensor channels.
- [ ] Confirm the installed E-115 EP3 variant and audit the current reference power/RPM curves against original sources.
- [x] Add more wind-specific books/papers and ACE/manufacturer reference links to the source shelf; preserve truthful indexing labels.
- [ ] Ingest the new reviewed PDFs into the intended knowledge database and run retrieval evaluation.
- [x] Return a versioned scenario result with baseline source, units, assumptions, and supported outputs.
- [x] Add the chat `+` Studio, natural-language scenario interpretation, editable supported values, compare/reset, and a lightweight ACE 3D view.
- [x] Add a deterministic wind-speed/power/energy scenario engine with explicit illustrative-versus-historical labels and unit tests.
- [ ] Verify the Studio visually and measure 3D performance on target phones; check live-data and populated-database behavior.
- [ ] Assess advanced pitch/load/design simulation only after turbine-specific engineering inputs and expert validation are available.
