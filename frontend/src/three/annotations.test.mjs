import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import * as THREE from "three";
import gsap from "gsap";
import { buildAnnotations } from "./annotations.js";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@shared/")) return nextResolve(new URL(`../../../shared/${specifier.slice(8)}`, import.meta.url).href, context);
  return nextResolve(specifier, context);
}});
const { TurbineScene } = await import("./TurbineScene.js");
const root = new THREE.Group();
const yaw = new THREE.Group();
root.add(yaw);
const annotations = buildAnnotations(root, yaw);
const ben = annotations.items.bigben;
assert.ok(Object.values(annotations.items).every((it) => !it.group.visible), "hidden before the first stage");
const originalMaterials = [];
root.traverse((o) => { if (o.material) originalMaterials.push([o, o.material]); });
for (const theme of ["realistic", "cartoon", "blueprint"]) {
  TurbineScene.prototype.applyTheme.call({ nodes: { root } }, theme);
  for (const [mesh, material] of originalMaterials) assert.equal(mesh.material, material, "theme must preserve annotation material");
  annotations.show(["height", "bigben"]);
  assert.equal(ben.group.visible, true);
  gsap.getTweensOf(ben.progress)[0].progress(0.5);
  annotations.show([]);
  assert.equal(ben.group.visible, false, "hide immediately on chapter exit");
  assert.equal(gsap.getTweensOf(ben.progress).length, 0, "cancel the actual tween target");
  assert.ok(ben.mats.every((mat) => mat.opacity === 0));
  annotations.show(["bigben"]);
  annotations.show([]);
  annotations.show(["bigben"]);
  assert.equal(gsap.getTweensOf(ben.progress).length, 1, "rapid switches leave only the active animation");
  gsap.getTweensOf(ben.progress)[0].progress(1);
  assert.equal(ben.group.visible, true, "comparison returns on loop restart");
  assert.equal(ben.mats[0].opacity, 0.2);
  annotations.show(["rotor"]);
  assert.equal(ben.group.visible, false);
  assert.equal(annotations.items.rotor.group.visible, true);
  annotations.show([]);
}
// Leaving a walk must restore the next chapter's comparison after the command exits it.
const scene = { rig: { walk: {} }, annotations, command() { this.rig.walk = null; } };
TurbineScene.prototype.applyStage.call(scene, { action: "hero", annotations: ["height", "bigben"] });
assert.equal(ben.group.visible, true);
scene.command = function () { this.rig.walk = {}; };
TurbineScene.prototype.applyStage.call(scene, { action: "walk_start", annotations: ["bigben"] });
assert.equal(ben.group.visible, false);
annotations.show([]);
gsap.ticker.sleep();
console.log("Annotations: initial visibility, all themes, chapter exit, rapid switching and comparison replay passed.");
