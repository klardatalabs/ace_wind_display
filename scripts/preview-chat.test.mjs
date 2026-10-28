import test from "node:test";
import assert from "node:assert/strict";
import { previewAnswer } from "./preview-chat.mjs";

test("preview chat distinguishes scenarios from unavailable research", () => {
  assert.match(previewAnswer("What if the wind were 10% faster?"), /hypothetical/i);
  assert.match(previewAnswer("Find research on direct-drive turbines"), /preview/i);
  assert.match(previewAnswer("Find a wind-turbine patent"), /no research database/i);
});
