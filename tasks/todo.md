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
- [x] Delay the heavy real-world viewer until its preceding chapter and fix the invalid rain graphic.
- [x] Prepare the visible 3D scene before hidden interior shaders; warm interiors after the first view.

## Wednesday release gate

- [ ] Pass server tests, frontend tests/build, retrieval checks, and visual/device walkthrough.
- [ ] Review repository and Git history for secrets, private data, licensing, and attribution.
- [ ] Verify deployment, rollback, and public-site health without disturbing other server workloads.
- [ ] Publish the chosen repository only after the audit passes and the remote is confirmed.
