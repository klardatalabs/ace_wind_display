# Weston Wind release tasks

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
