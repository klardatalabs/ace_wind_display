import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { buildInteriors } from "./interiors.js";
import { inspectionTargets, inspectionRoot, inspectionFrame, cablePointAtHeight, visibleIntersection, InspectionHighlight, WindingInspection } from "./inspection.js";
import { TOWER_PARTS, NACELLE_PARTS } from "../content/explorerParts.js";

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const file = await readFile(new URL("../../public/models/ace-turbine.glb", import.meta.url));
const { scene: root } = await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), "");
const nodes = {
  root, yaw: root.getObjectByName("Yaw"),
  generatorRotor: root.getObjectByName("ACE_GeneratorRotor"),
  nacelleInternals: root.getObjectByName("ACE_NacelleInternals"),
};
const pivot = new THREE.Group();
root.add(pivot);
const interiors = buildInteriors(nodes, pivot, { explorer: true });
root.traverse(object => {
  if (object.isMesh && !object.material) object.material = new THREE.MeshBasicMaterial();
});
root.updateMatrixWorld(true);

test("every interior menu entry resolves to actual geometry in its own room", () => {
  for (const [room, ids] of [["tower", TOWER_PARTS], ["nacelle", NACELLE_PARTS]]) {
    for (const id of ids) {
      const targets = inspectionTargets(root, id, room);
      assert.ok(targets.length, `${room}/${id} has no selectable object`);
      for (const target of targets) {
        const frame = inspectionFrame(target, target.userData.inspection.defaultInstance);
        assert.ok(frame.size.length() > 0, `${room}/${id} has no geometry`);
        assert.ok(room === "tower" ? frame.center.y < 89 : frame.center.y >= 89);
      }
    }
  }
});

test("nacelle controls cannot resolve to tower converters or a merged placeholder", () => {
  assert.equal(inspectionTargets(root, "control", "nacelle").length, 3);
  assert.equal(inspectionTargets(root, "control", "tower").length, 0);
  assert.equal(inspectionTargets(root, "converter", "tower").length, 3);
  assert.equal(inspectionTargets(root, "converter", "nacelle").length, 0);
  assert.equal(root.getObjectByName("ACE_NacelleInternals_4").visible, false);
});

test("platform targets keep their physical level, and the lift cable is not the lift", () => {
  assert.deepEqual(inspectionTargets(root, "platform", "tower").map(object => inspectionFrame(object).center.y), [22, 44, 66, 88]);
  const [lift] = inspectionTargets(root, "lift", "tower");
  assert.equal(lift, interiors.lift);
  assert.ok(inspectionFrame(lift).size.y < 2);
  const liftCable = interiors.towerInterior.children.find(object => object.userData.hotspot === "lift");
  assert.equal(liftCable.userData.noPick, true);
  assert.equal(inspectionRoot(liftCable), null);
});

test("different winding instances have distinct world-space focus points and highlights", () => {
  const coils = interiors.coils;
  const a = inspectionFrame(coils, 8), b = inspectionFrame(coils, 16);
  assert.ok(a.center.distanceTo(b.center) > 2);
  assert.ok(a.size.length() < 2);
  const highlight = new InspectionHighlight();
  highlight.select(coils, 16);
  assert.equal(highlight.lines.length, 1);
  const expected = new THREE.Matrix4();
  coils.getMatrixAt(16, expected);
  assert.ok(highlight.lines[0].matrix.equals(expected));
  highlight.clear();
  assert.equal(coils.children.length, 0);
});

test("cable selection follows the curved geometry at each inspection level", () => {
  const [cable] = inspectionTargets(root, "cable", "tower");
  for (const height of [3.2, 22, 44, 66, 88]) {
    const point = cablePointAtHeight(cable, height);
    assert.ok(Math.abs(point.y - height) < .001);
    assert.ok(point.x >= .79 && point.x <= 1.1);
  }
  assert.ok(cablePointAtHeight(cable, 3.2).z > .59);
});

test("winding inspection keeps the selected instance in place and restores every original material", () => {
  const inspection = new WindingInspection();
  const coils = interiors.coils;
  const source = coils.material;
  const originalShadow = coils.castShadow;
  const expected = new THREE.Matrix4();
  coils.getMatrixAt(32, expected);
  inspection.select(coils, 32, nodes.yaw);
  assert.equal(inspection.proxy.geometry, coils.geometry);
  assert.ok(inspection.proxy.matrix.equals(expected));
  assert.deepEqual(inspection.proxy.userData.inspectionProxy, { object: coils, instanceId: 32 });
  assert.equal(inspection.proxy.material.opacity, 1);
  assert.equal(coils.material.opacity, .14);
  assert.equal(coils.material.depthWrite, false);
  assert.equal(coils.userData.inspectionGhost, true);
  const faded = coils.material;
  const firstProxy = inspection.proxy;
  inspection.select(coils, 40, nodes.yaw);
  assert.equal(coils.material, faded);
  assert.equal(inspection.proxy, firstProxy);
  assert.equal(inspection.proxy.userData.inspectionProxy.instanceId, 40);
  coils.getMatrixAt(40, expected);
  assert.ok(inspection.proxy.matrix.equals(expected));
  const fadedMaterials = inspection.originals.map(({ mesh }) => mesh.material);
  let disposed = 0;
  for (const material of fadedMaterials) material.addEventListener("dispose", () => disposed++);
  const proxy = inspection.proxy;
  inspection.clear();
  assert.equal(disposed, fadedMaterials.length);
  assert.equal(proxy.parent, null);
  assert.equal(coils.material, source);
  assert.equal(coils.castShadow, originalShadow);
  assert.equal(coils.userData.inspectionGhost, undefined);
  assert.equal(coils.children.length, 0);
});

test("CPU picking respects hidden ancestors and union/intersection clipping", () => {
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  const group = new THREE.Group();
  group.add(mesh);
  const hit = { object: mesh, point: new THREE.Vector3(-1, 1, 0) };
  assert.equal(visibleIntersection(hit), true);
  group.visible = false;
  assert.equal(visibleIntersection(hit), false);
  group.visible = true;
  material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(1, 0, 0)), new THREE.Plane(new THREE.Vector3(0, 1, 0))];
  assert.equal(visibleIntersection(hit), false);
  material.clipIntersection = true;
  assert.equal(visibleIntersection(hit), true);
  hit.point.y = -1;
  assert.equal(visibleIntersection(hit), false);
});
