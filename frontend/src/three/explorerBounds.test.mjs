import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { constrainInterior } from "./explorerBounds.js";

test("tower movement stays inside the wall at every climb height", () => {
  for (const height of [1.7, 22, 44, 66, 88]) {
    const position = constrainInterior(new Vector3(20, height, 20));
    assert.equal(position.y, height);
    assert.ok(Math.hypot(position.x, position.z) < 2);
  }
});

test("machine-room movement stays within the aisle and roof height", () => {
  const position = constrainInterior(new Vector3(-50, 200, 50));
  assert.equal(position.x, -6.8);
  assert.equal(position.y, 93.3);
  assert.equal(position.z, 1.8);
});

test("a valid interior position is preserved, and movement cannot fall below the base", () => {
  const position = new Vector3(0, 44, -.65);
  constrainInterior(position);
  assert.deepEqual(position.toArray(), [0, 44, -.65]);
  assert.equal(constrainInterior(new Vector3(0, -10, 0)).y, 1.7);
});
