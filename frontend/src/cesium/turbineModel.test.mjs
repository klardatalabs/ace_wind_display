import test from "node:test";
import assert from "node:assert/strict";
import * as Cesium from "cesium";
import { SITE_COORDS } from "./siteConfig.js";
import { turbineModelMatrix } from "./turbineModel.js";

test("turbine origin round-trips to the exact site coordinates and supplied ellipsoid height", () => {
  const matrix = turbineModelMatrix({ turbineHeadingDeg: 37, turbineScale: 1, turbineHeightOffsetM: 2.5 }, 18.25);
  const origin = Cesium.Matrix4.getTranslation(matrix, new Cesium.Cartesian3());
  const cartographic = Cesium.Cartographic.fromCartesian(origin);
  assert.ok(Math.abs(Cesium.Math.toDegrees(cartographic.latitude) - SITE_COORDS.lat) < 1e-8);
  assert.ok(Math.abs(Cesium.Math.toDegrees(cartographic.longitude) - SITE_COORDS.lon) < 1e-8);
  assert.ok(Math.abs(cartographic.height - 20.75) < 0.001);
});

test("model scale changes size without moving its geographic origin", () => {
  const matrix = turbineModelMatrix({ turbineHeadingDeg: 0, turbineScale: 1.5, turbineHeightOffsetM: 0 }, 30);
  const x = Cesium.Matrix4.multiplyByPointAsVector(matrix, Cesium.Cartesian3.UNIT_X, new Cesium.Cartesian3());
  assert.ok(Math.abs(Cesium.Cartesian3.magnitude(x) - 1.5) < 1e-10);
});
