// Measurements drawn in the scene itself, like an engineer's drawing laid over the real
// place: how tall the turbine is, how wide the rotor, how it compares with Big Ben.
// Each one "draws itself" when shown (the bar grows, the end ticks and label fade in).

import * as THREE from "three";
import gsap from "gsap";

const WHITE = 0xffffff;

function material() {
  return new THREE.MeshBasicMaterial({ color: WHITE, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
}

const UP = new THREE.Vector3(0, 1, 0);

/** A bar between two points with an end tick at each end (ticks run along `tickAxis`). */
function dimension(a, b, { tickAxis = new THREE.Vector3(1, 0, 0), thickness = 0.35, tick = 6 } = {}) {
  const group = new THREE.Group();
  const dir = b.clone().sub(a);
  const length = dir.length();
  const mat = material();

  // the bar's base sits at `a` and it grows toward `b` as its y-scale goes from 0 to `length`
  const wrap = new THREE.Group();
  wrap.position.copy(a);
  wrap.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  group.add(wrap);
  const geometry = new THREE.CylinderGeometry(thickness, thickness, 1, 6);
  geometry.translate(0, 0.5, 0);
  const bar = new THREE.Mesh(geometry, mat);
  bar.scale.set(1, 0.0001, 1);
  wrap.add(bar);

  for (const p of [a, b]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.8, thickness * 0.8, tick, 6), mat);
    t.position.copy(p);
    t.quaternion.setFromUnitVectors(UP, tickAxis.clone().normalize());
    group.add(t);
  }
  group.traverse((o) => (o.renderOrder = 30));
  return { group, bar, mat, length };
}

function bigBen() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, toneMapped: false });
  const parts = [
    new THREE.BoxGeometry(11, 62, 11).translate(0, 31, 0),
    new THREE.BoxGeometry(14, 20, 14).translate(0, 72, 0),
    new THREE.ConeGeometry(10.5, 22, 4).rotateY(Math.PI / 4).translate(0, 93, 0),
  ];
  for (const g of parts) {
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 28;
    group.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), lineMat);
    e.renderOrder = 29;
    group.add(e);
  }
  const top = new THREE.Vector3(0, 104, 0); // spire tip ~ 96 m after the cone's apex at 104? the cone is 22 tall from 82 → 104; scaled below
  group.scale.setScalar(96 / 104);
  return { group, mats: [mat, lineMat], top: top.clone().multiplyScalar(96 / 104) };
}

/**
 * @param {THREE.Object3D} towerPivot  turns with the nacelle (so annotations face the camera shots)
 * @param {THREE.Object3D} yaw         the nacelle node, for rotor-plane annotations
 */
export function buildAnnotations(towerPivot, yaw) {
  const items = {};

  const height = dimension(new THREE.Vector3(26, 0, 30), new THREE.Vector3(26, 150, 30), { tickAxis: new THREE.Vector3(1, 0, 0), tick: 9 });
  towerPivot.add(height.group);
  items.height = { ...height, anchor: new THREE.Vector3(26, 150, 30), root: towerPivot, kind: "bar" };

  const hub = dimension(new THREE.Vector3(-22, 0, 30), new THREE.Vector3(-22, 92, 30), { tickAxis: new THREE.Vector3(1, 0, 0), tick: 9 });
  towerPivot.add(hub.group);
  items.hub = { ...hub, anchor: new THREE.Vector3(-22, 92, 30), root: towerPivot, kind: "bar" };

  const rotor = dimension(new THREE.Vector3(10, 3, -57.85), new THREE.Vector3(10, 3, 57.85), { tickAxis: new THREE.Vector3(0, 1, 0), tick: 12, thickness: 0.4 });
  yaw.add(rotor.group);
  items.rotor = { ...rotor, anchor: new THREE.Vector3(10, 3, 0), root: yaw, kind: "bar" };

  const ben = bigBen();
  ben.group.position.set(-46, 0, 18);
  towerPivot.add(ben.group);
  items.bigben = { group: ben.group, mats: ben.mats, anchor: ben.top.clone().add(new THREE.Vector3(-46, 0, 18)), root: towerPivot, kind: "ghost" };

  const state = {};
  for (const it of Object.values(items)) {
    it.group.visible = false;
    it.progress = { v: 0 };
    it.group.traverse((o) => {
      o.userData.noPick = true;
      o.userData.isAnnotation = true;
    });
  }

  /** Only the active chapter's measurements belong in the scene. */
  function show(names = []) {
    for (const [name, it] of Object.entries(items)) {
      const on = names.includes(name);
      if (state[name] === on) continue;
      state[name] = on;
      gsap.killTweensOf(it.progress);
      it.group.visible = on;
      if (!on) {
        it.progress.v = 0;
        if (it.kind === "bar") it.mat.opacity = 0;
        else for (const mat of it.mats) mat.opacity = 0;
        continue;
      }
      gsap.to(it.progress, {
        v: 1,
        duration: it.kind === "bar" ? 1.6 : 1.4,
        ease: it.kind === "bar" ? "power3.out" : "power2.out",
        onUpdate: () => {
          const v = it.progress.v;
          if (it.kind === "bar") {
            it.bar.scale.set(1, Math.max(0.0001, v * it.length), 1);
            it.mat.opacity = 0.92 * Math.min(1, v * 3);
          } else {
            it.mats[0].opacity = 0.2 * v;
            it.mats[1].opacity = 0.85 * v;
          }
        },
      });
    }
  }

  /** World position of an annotation's label anchor object (created lazily). */
  const anchors = {};
  for (const [name, it] of Object.entries(items)) {
    const o = new THREE.Object3D();
    o.name = `anchor-${name}`;
    o.position.copy(it.anchor);
    it.root.add(o);
    anchors[name] = o;
  }

  return { show, anchors, items };
}
