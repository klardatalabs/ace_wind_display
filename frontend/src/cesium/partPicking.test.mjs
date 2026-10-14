import test from "node:test";
import assert from "node:assert/strict";
import * as Cesium from "cesium";
import { findTurbinePart, partIdForNode, pickTurbinePart } from "./partPicking.js";

test("specific model nodes map to their own information cards", () => {
  assert.equal(partIdForNode("ACE_TowerEntrance"), "door");
  assert.equal(partIdForNode("ACE_TowerBands"), "tower");
  assert.equal(partIdForNode("ACE_NacelleShell"), "nacelle");
  assert.equal(partIdForNode("ACE_Blade_2"), "blade");
  assert.equal(partIdForNode("ACE_RoofSensors"), "sensors");
});

function fixture() {
  const node = {
    node: { name: "ACE_NacelleShell" },
    computedTransform: Cesium.Matrix4.fromTranslation(new Cesium.Cartesian3(0, 90, 0)),
    runtimePrimitives: [{ boundingSphere: new Cesium.BoundingSphere(new Cesium.Cartesian3(1, 0, 0), 3) }],
  };
  const model = {
    ready: true,
    boundingSphere: new Cesium.BoundingSphere(Cesium.Cartesian3.ZERO, 85),
    _sceneGraph: { computedModelMatrix: Cesium.Matrix4.fromTranslation(new Cesium.Cartesian3(100, 0, 200)), _runtimeNodes: [node] },
  };
  return { model, node };
}

test("a picked part is framed using its world-space bounds, not the entire turbine", () => {
  const { model, node } = fixture();
  const pick = pickTurbinePart({ primitive: model, detail: { node } }, model);
  assert.equal(pick.id, "nacelle");
  assert.equal(pick.sphere.radius, 3);
  assert.ok(Cesium.Cartesian3.equals(pick.sphere.center, new Cesium.Cartesian3(101, 90, 200)));
  assert.equal(findTurbinePart(model, "nacelle").sphere.radius, 3);
});

test("nearby map geometry never produces an ACE part selection", () => {
  const { model } = fixture();
  assert.equal(pickTurbinePart({ primitive: {} }, model), null);
});

test("missing runtime detail falls back safely without breaking selection", () => {
  const { model } = fixture();
  const picked = pickTurbinePart({ primitive: model }, model);
  assert.equal(picked.id, "turbine");
  assert.equal(picked.sphere.radius, 85);
});
