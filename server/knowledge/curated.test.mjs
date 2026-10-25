import { test } from "node:test";
import assert from "node:assert/strict";
import { CURATED_SOURCES } from "./curated.js";

test("curated research has stable identities and source citations", () => {
  assert.equal(new Set(CURATED_SOURCES.map((s) => s.id)).size, CURATED_SOURCES.length);
  assert.deepEqual(new Set(CURATED_SOURCES.map((s) => s.sourceType)), new Set(["book", "paper", "patent"]));
  for (const source of CURATED_SOURCES) {
    assert.match(source.id, /^[a-z0-9-]+$/);
    assert.equal(new URL(source.sourceUrl).protocol, "https:");
    assert.equal(new URL(source.downloadUrl).protocol, "https:");
    assert.ok(source.title && source.author && source.rightsNote);
  }
});
