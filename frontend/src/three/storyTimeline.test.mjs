import assert from "node:assert/strict";
import { chapterAt, chapterStart, railProgress, STORY_SECONDS } from "./storyTimeline.ts";

assert.equal(STORY_SECONDS, 100);
assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map(chapterStart), [0, 11, 23, 30, 40, 50, 64, 76, 88]);
for (let index = 0; index < 9; index++) {
  assert.deepEqual(chapterAt(chapterStart(index)), { index, progress: 0 });
}
const distances = [0, 0.14, 0.19, 0.21, 0.31, 0.53, 0.7, 0.85, 0.95, 1];
let previous = -1;
for (let time = 0; time < STORY_SECONDS; time += 0.02) {
  const progress = railProgress(time, distances);
  assert.ok(progress > previous, `Camera must keep moving at ${time}s`);
  assert.ok(progress >= 0 && progress <= 1);
  previous = progress;
}
console.log("Story timing: nine chapter seeks, bounds, and continuous forward travel passed.");
const times = [0, 11, 23, 30, 40, 46, 50, 64, 76, 78, 80, 88, 94, 100];
const transformerRail = [0, 0.1, 0.15, 0.18, 0.3, 0.35, 0.6, 0.7, 0.8, 0.82, 0.9, 0.94, 0.98, 1];
assert.equal(railProgress(46, transformerRail, times), 0.35);
assert.equal(railProgress(100, transformerRail, times), 1);
previous = -1;
for (let time = 0; time <= 100; time += 0.02) {
  const progress = railProgress(time, transformerRail, times);
  assert.ok(progress > previous);
  previous = progress;
}
