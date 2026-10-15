// The college screen's "Go inside" chapter: an X-ray climb. The turbine turns see-through
// (the "xray" look in themes.js) and the camera follows a technician's route from the
// piles under the ground to the hub, stopping at each level while the parts there light up
// and get labelled (content/screens.js XRAY_COPY and TAGS). Shots are in the nacelle's frame,
// like cameraRig.js SHOTS, so the view keeps facing the rotor whatever the wind does.
// The stops themselves are in xrayStops.js (plain data, so the captions can share them).

import * as THREE from "three";
import { towerRadiusAt } from "./interiors.js";
import { XRAY_STOPS as STOPS } from "./xrayStops.js";

/** The stops with their shots as vectors, for the camera rig. */
export const XRAY_STOPS = STOPS.map((stop) => ({ ...stop, shot: { pos: new THREE.Vector3(...stop.shot.pos), target: new THREE.Vector3(...stop.shot.target) } }));

// The foundation, drawn only in the X-ray: ACE's timeline says 22 piles, each 18 m long,
// went in because of the poor ground. Their layout here is illustrative.
const PILE_COUNT = 22;
const PILE_LENGTH = 18;
const PAD_DEPTH = 4; // so the whole foundation is 22 m deep, as Wikipedia gives it

/** The foundation pad and its piles, under the tower. Hidden until the X-ray shows it. */
export function buildFoundation() {
  const g = new THREE.Group();
  g.name = "XrayFoundation";
  g.visible = false;
  const tag = (mesh, part, hotspot) => {
    mesh.userData.part = part;
    mesh.userData.hotspot = hotspot;
    mesh.castShadow = mesh.receiveShadow = false;
    return mesh;
  };
  // The pad is drawn faintly, like the tower shell; the piles are what this stop is about.
  const pad = tag(new THREE.Mesh(new THREE.CylinderGeometry(9, 9.6, PAD_DEPTH, 48), null), "body", "pad");
  pad.position.y = -PAD_DEPTH / 2 - 0.05;
  g.add(pad);
  // The tower's bottom ring, cast into the pad.
  const r = towerRadiusAt(0);
  const ring = tag(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.35, r + 0.35, 1.6, 40, 1, true), null), "metal", "pad");
  ring.position.y = -0.9;
  g.add(ring);
  const piles = tag(new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.32, PILE_LENGTH, 10), null, PILE_COUNT), "metal", "piles");
  const m = new THREE.Matrix4();
  const rings = [[8, 3.6], [14, 7.4]];
  let i = 0;
  for (const [count, radius] of rings) {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + (radius > 5 ? Math.PI / count : 0);
      m.makeTranslation(Math.cos(a) * radius, -PAD_DEPTH - PILE_LENGTH / 2, Math.sin(a) * radius);
      piles.setMatrixAt(i++, m);
    }
  }
  g.add(piles);
  return g;
}

/** Points the labels hang from, in the frames that turn with the nacelle. */
export function xrayAnchors(towerPivot, yaw, lift) {
  const at = (parent, name, x, y, z) => {
    const o = new THREE.Object3D();
    o.name = `tag-x-${name}`;
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  return {
    xPiles: at(towerPivot, "piles", 7.4, -12, 2),
    xPad: at(towerPivot, "pad", -6, -1.2, 5),
    xConverter: at(towerPivot, "converter", -0.2, 2.8, -1.1),
    xDoor: at(towerPivot, "door", 1.4, 1.2, 1.6),
    xLadder: at(towerPivot, "ladder", 0.3, 27, -1.55),
    xPlatform: at(towerPivot, "platform", 1.4, 22.2, 0.6),
    xFlange: at(towerPivot, "flange", -1.9, 31, 0.4),
    xLift: at(lift, "lift", 0, 1.4, 0),
    xCable: at(towerPivot, "cable", 1.0, 56, 0.35),
    xWall: at(towerPivot, "wall", -1.9, 50, 0.4),
    xYaw: at(yaw, "yaw", 0.3, 0.4, 1.9),
    xYawDrive: at(yaw, "yawdrive", 1.3, 1.2, -0.8),
    xCableLoop: at(towerPivot, "loop", 0.9, 86.5, 0.2),
    xGenerator: at(yaw, "generator", 2.35, 5.5, 0.3),
    xStator: at(yaw, "stator", 2.35, 3, 2.45),
    xBearing: at(yaw, "bearing", 1.2, 3.6, 0.5),
    xCooling: at(yaw, "cooling", -7.2, 4.3, 0.8),
    xSensors: at(yaw, "sensors", -5.6, 6.1, 0),
    xHub: at(yaw, "hub", 8.2, 3.4, 0),
    xPitch: at(yaw, "pitch", 6.2, 5.2, 1.4),
    xBladeRoot: at(yaw, "bladeroot", 4.8, 3, 4.4),
  };
}

/** Lights up the parts at a stop in green, and dims the rest back to their X-ray look. */
export function lightParts(root, ids, glow) {
  const lit = new Set(ids);
  root.traverse((o) => {
    if (!o.isMesh || !o.userData.hotspot || !o.material?.color) return;
    const m = o.material;
    if (!o.userData.xrayBase) o.userData.xrayBase = { color: m.color.getHex(), opacity: m.opacity };
    const base = o.userData.xrayBase;
    const on = lit.has(o.userData.hotspot);
    m.color.setHex(on ? glow : base.color);
    m.opacity = on ? Math.min(0.9, Math.max(0.7, base.opacity + 0.25)) : base.opacity;
  });
}

/** Forgets the stored X-ray colours (materials are rebuilt on every theme change). */
export function clearLit(root) {
  root.traverse((o) => {
    if (o.userData.xrayBase) delete o.userData.xrayBase;
  });
}
