import test from "node:test";
import assert from "node:assert/strict";
import { buildLibrary } from "./library.js";

test("library distinguishes loaded research from further reading", () => {
  const before = buildLibrary();
  assert.equal(before.items.length, 8);
  const source = before.items[0];
  const result = buildLibrary([{ sourceUrl: source.url, passages: 12 }]);
  assert.equal(result.items.find((item) => item.id === source.id).chatReady, true);
  assert.equal(result.items.find((item) => item.id === "openstax-university-physics-1").chatReady, false);
  assert.equal(buildLibrary([{ sourceUrl: source.url, passages: 12 }], "unavailable").items[0].chatReady, false);
});
