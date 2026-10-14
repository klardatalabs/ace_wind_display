import test from "node:test";
import assert from "node:assert/strict";
import { fuse } from "./search.js";

test("reciprocal-rank fusion rewards passages found by both searches", () => {
  const vector = [{ chunk_id: 1 }, { chunk_id: 2 }, { chunk_id: 3 }];
  const keyword = [{ chunk_id: 3 }, { chunk_id: 4 }];
  const fused = fuse([vector, keyword], 4).map((r) => r.chunk_id);
  assert.equal(fused[0], 3, "3 is in both lists, so it wins despite ranking lower in each");
  assert.deepEqual([...fused].sort(), [1, 2, 3, 4]);
  assert.equal(fuse([vector, keyword], 2).length, 2);
});
