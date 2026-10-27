import test from "node:test";
import assert from "node:assert/strict";
import { buildLibrary, FURTHER_READING } from "./library.js";
import { CURATED_SOURCES } from "./curated.js";

test("library distinguishes loaded research from further reading", () => {
  const before = buildLibrary();
  assert.equal(before.items.length, CURATED_SOURCES.length + FURTHER_READING.length);
  const source = before.items.find((item) => CURATED_SOURCES.find((curated) => curated.id === item.id)?.indexable);
  const result = buildLibrary([{ sourceUrl: source.url, passages: 12 }]);
  assert.equal(result.items.find((item) => item.id === source.id).chatReady, true);
  assert.equal(buildLibrary([{ sourceUrl: before.items[0].url, passages: 12 }]).items[0].chatReady, false);
  assert.equal(result.items.find((item) => item.id === "doe-small-wind-guidebook").chatReady, false);
  assert.equal(result.items.find((item) => item.id === "ace-zenodo-data").chatReady, false);
  assert.equal(buildLibrary([{ sourceUrl: source.url, passages: 12 }], "unavailable").items[0].chatReady, false);
});
