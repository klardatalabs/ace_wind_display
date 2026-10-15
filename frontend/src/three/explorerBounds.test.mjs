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
  assert.equal(position.x, -5.8);
  assert.equal(position.y, 93.3);
  assert.equal(position.z, 1.25);
});

test("the front inspection aisle permits a clear view around the generator rim", () => {
  const position = constrainInterior(new Vector3(.9, 93.3, 5));
  assert.equal(position.z, 2.15);
});

test("a valid interior position is preserved, and movement cannot fall below the base", () => {
  const position = new Vector3(0, 44, -.65);
  constrainInterior(position);
  assert.deepEqual(position.toArray(), [0, 44, -.65]);
  assert.equal(constrainInterior(new Vector3(0, -10, 0)).y, 1.7);
});

test("descending in the machine room stays over the floor until the open hatch", () => {
  const previous = new Vector3(-4, 90.6, 1);
  const blocked = constrainInterior(new Vector3(-4, 90.4, 1), previous);
  assert.ok(blocked.y >= 90.5);
  assert.equal(blocked.x, -4);
  const throughHatch = constrainInterior(new Vector3(0, 90.4, -.5), new Vector3(0, 90.6, -.5));
  assert.equal(throughHatch.y, 90.4);
});
