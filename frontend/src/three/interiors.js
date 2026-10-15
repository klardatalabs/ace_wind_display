// Procedural interior so "Look inside" has something worth seeing: ladder, service lift,
// platforms and cables in the tower; converter cabinets and transformer at the base;
// yaw ring + drives, main bearing and copper stator coils in the nacelle.
// Parts are tagged with userData.part so themes can style them, and label anchors are
// returned for the HUD.

import * as THREE from "three";

export const TOWER_TOP = 88.6;
// The tower tapers from ~2.32 m radius at the base to ~1.6 m under the nacelle.
export const towerRadiusAt = (y) => 2.32 - 0.72 * THREE.MathUtils.clamp(y / TOWER_TOP, 0, 1);
const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
};

function part(mesh, kind, hotspot) {
  mesh.userData.part = kind; // "metal" | "accent" | "copper" | "cabinet" | "cable"
  if (hotspot) mesh.userData.hotspot = hotspot;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function box(w, h, d, kind, hotspot) {
  const m = part(new THREE.Mesh(geo.box, null), kind, hotspot);
  m.scale.set(w, h, d);
  return m;
}

function cylinder(r, h, kind, hotspot) {
  const m = part(new THREE.Mesh(geo.cyl, null), kind, hotspot);
  m.scale.set(r, h, r);
  return m;
}

function buildTower() {
  const g = new THREE.Group();
  g.name = "TowerInterior";

  // Ladder up the back wall (stays visible when the front half peels away).
  const rails = [-0.32, 0.32].map((x) => {
    const r = box(0.07, TOWER_TOP - 1, 0.07, "metal", "ladder");
    r.position.set(x, (TOWER_TOP + 1) / 2, -1.55);
    return r;
  });
  g.add(...rails);
  const rungCount = Math.floor((TOWER_TOP - 2) / 0.6);
  const rungs = part(new THREE.InstancedMesh(geo.box, null, rungCount), "metal", "ladder");
  const m = new THREE.Matrix4();
  for (let i = 0; i < rungCount; i++) {
    m.compose(new THREE.Vector3(0, 1.4 + i * 0.6, -1.55), new THREE.Quaternion(), new THREE.Vector3(0.64, 0.05, 0.05));
    rungs.setMatrixAt(i, m);
  }
  g.add(rungs);

  // Platforms every ~22 m, each with a round hatch where the ladder comes through.
  for (let y = 22; y < TOWER_TOP; y += 22) {
    const r = towerRadiusAt(y) - 0.14;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, r, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, -0.85, 0.95, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false, curveSegments: 40 });
    geometry.rotateX(Math.PI / 2); // lie flat; the shape's y becomes world z, the extrusion goes down
    const p = part(new THREE.Mesh(geometry, null), "metal", "platform");
    p.position.y = y;
    g.add(p);
  }

  // Flange rings where the tower sections are bolted together, every 7 m.
  const ringCount = Math.floor(TOWER_TOP / 7);
  const rings = part(new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.045, 6, 48).rotateX(Math.PI / 2), null, ringCount), "metal");
  const rm = new THREE.Matrix4();
  for (let i = 0; i < ringCount; i++) {
    const y = 3 + i * 7;
    const r = towerRadiusAt(y) - 0.05;
    rm.compose(new THREE.Vector3(0, y, 0), new THREE.Quaternion(), new THREE.Vector3(r, 1, r));
    rings.setMatrixAt(i, rm);
  }
  g.add(rings);

  // Lamps along the wall so the climb is lit.
  const lampCount = Math.floor(TOWER_TOP / 6);
  const lamps = part(new THREE.InstancedMesh(geo.box, null, lampCount), "lamp");
  for (let i = 0; i < lampCount; i++) {
    const y = 4 + i * 6;
    const a = 0.9 + (i % 2) * 1.2; // alternate sides of the ladder
    const r = towerRadiusAt(y) - 0.32;
    rm.compose(new THREE.Vector3(Math.sin(a) * r, y, -Math.cos(a) * r), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI - a), new THREE.Vector3(0.12, 0.28, 0.3));
    lamps.setMatrixAt(i, rm);
  }
  g.add(lamps);

  // Power cables hanging from the nacelle to the converter.
  const cablePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.9, TOWER_TOP, 0.2),
    new THREE.Vector3(1.0, 60, 0.4),
    new THREE.Vector3(0.95, 25, 0.3),
    new THREE.Vector3(0.8, 3.2, 0.6),
  ]);
  g.add(part(new THREE.Mesh(new THREE.TubeGeometry(cablePath, 80, 0.13, 8), null), "cable", "cable"));

  // Service lift (animated by the scene).
  const lift = new THREE.Group();
  lift.name = "ServiceLift";
  const cage = box(0.9, 1.3, 0.9, "accent", "lift");
  cage.position.y = 0.65;
  lift.add(cage);
  lift.position.set(-0.8, 6, -0.6);
  g.add(lift);
  const liftCable = box(0.03, TOWER_TOP - 2, 0.03, "metal", "lift");
  liftCable.position.set(-0.8, TOWER_TOP / 2 + 1, -0.6);
  g.add(liftCable);

  // Converter cabinets at the tower base.
  [-1.1, -0.2, 0.7].forEach((x, i) => {
    const c = box(0.8, 2, 0.7, "cabinet", "cabinet");
    c.position.set(x, 1.6, -1.2 + Math.abs(i - 1) * 0.25);
    g.add(c);
  });

  return { group: g, lift, cablePath };
}

function buildNacelle() {
  const g = new THREE.Group();
  g.name = "NacelleInterior";

  // Yaw bearing ring + drives around it.
  const ring = part(new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.16, 10, 48), null), "accent", "yaw");
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.35;
  g.add(ring);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const drive = cylinder(0.22, 1.1, "accent", "yaw");
    drive.position.set(Math.cos(a) * 1.45, 0.95, Math.sin(a) * 1.45);
    g.add(drive);
  }

  // Main bearing / axle journal toward the hub.
  const axle = cylinder(0.55, 2.2, "metal", "mainshaft");
  axle.rotation.z = Math.PI / 2;
  axle.position.set(1.5, 3, 0);
  g.add(axle);

  // Stator: a ring of copper coils just outside the rotating generator.
  const coilCount = 48;
  const coils = part(new THREE.InstancedMesh(geo.box, null, coilCount), "copper", "stator");
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < coilCount; i++) {
    const a = (i / coilCount) * Math.PI * 2;
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
    m.compose(new THREE.Vector3(2.35, 3 + Math.cos(a) * 2.42, Math.sin(a) * 2.42), q, new THREE.Vector3(1.05, 0.16, 0.26));
    coils.setMatrixAt(i, m);
  }
  g.add(coils);
  g.userData.coils = coils;

  // Floor of the machine room, with the hatch down to the tower.
  const floorShape = new THREE.Shape();
  floorShape.moveTo(-7.6, -2.75);
  floorShape.lineTo(2.6, -2.75);
  floorShape.lineTo(2.6, 2.75);
  floorShape.lineTo(-7.6, 2.75);
  floorShape.closePath();
  const hatch = new THREE.Path();
  hatch.absarc(0, 0, 1.0, 0, Math.PI * 2, true);
  floorShape.holes.push(hatch);
  const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 0.16, bevelEnabled: false, curveSegments: 32 });
  floorGeo.rotateX(Math.PI / 2);
  const floor = part(new THREE.Mesh(floorGeo, null), "metal", "machinery");
  floor.position.set(0, 0.46, 0);
  g.add(floor);

  // Warm lights in the machine room, switched on while visitors are inside.
  const lights = [];
  for (const [x, y, z] of [[-4.6, 5.1, 0], [-0.4, 5.1, 0.6], [1.6, 5.0, -0.6]]) {
    const light = new THREE.PointLight(0xffe6bd, 0, 16, 2);
    light.position.set(x, y, z);
    g.add(light);
    lights.push(light);
  }
  g.userData.lights = lights;

  // Cooling fans at the rear.
  [-0.9, 0.9].forEach((z) => {
    const fan = cylinder(0.55, 0.25, "metal", "fans");
    fan.rotation.z = Math.PI / 2;
    fan.position.set(-7.4, 3.6, z);
    g.add(fan);
  });

  return g;
}

/**
 * @param {object} nodes from loadTurbine()
 * @param {THREE.Object3D} towerPivot  group that turns with the nacelle (holds tower halves)
 */
export function buildInteriors(nodes, towerPivot) {
  const tower = buildTower();
  towerPivot.add(tower.group);
  const nacelle = buildNacelle();
  nodes.yaw.add(nacelle);

  const anchor = (parent, name, x, y, z) => {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const labels = [
    { id: "generator", text: "Ring generator", detail: "No gearbox — electromagnets pass copper coils", anchor: anchor(nodes.yaw, "lbl-gen", 2.4, 5.6, 1.2) },
    { id: "hub", text: "Hub & blade pitch", detail: "Blades twist to catch or spill wind", anchor: anchor(nodes.yaw, "lbl-hub", 6.2, 3.2, 2.6) },
    { id: "cabinets", text: "Control cabinets", detail: "The turbine's brain", anchor: anchor(nodes.yaw, "lbl-cab", -4.2, 4.0, 1.5) },
    { id: "yaw", text: "Yaw drives", detail: "Turn the nacelle to face the wind", anchor: anchor(nodes.yaw, "lbl-yaw", 1.6, 0.6, 2.0) },
    { id: "ladder", text: "Ladder & service lift", detail: "About 90 m up to the nacelle", anchor: anchor(towerPivot, "lbl-ladder", 0, 40, 0) },
    { id: "converter", text: "Converter", detail: "Matches the power to the grid", anchor: anchor(towerPivot, "lbl-conv", 0, 2.4, 0) },
  ];

  return { towerInterior: tower.group, nacelleInterior: nacelle, lift: tower.lift, labels, nacelleLights: nacelle.userData.lights, cablePath: tower.cablePath, coils: nacelle.userData.coils };
}

/** A temporary hatch in the existing solid plates; model geometry stays unchanged. */
export function buildWalkHatch(nodes) {
  const planes = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -0.65),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), -0.65),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -2.4),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), -89),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.25),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), -1.45),
  ];
  const worldPlanes = planes.map((p) => p.clone());
  const plates = [];
  nodes.nacelleInternals.traverse((o) => {
    if (o.isMesh && ["ACE_NacelleInternals_1", "ACE_NacelleInternals_3"].includes(o.name)) plates.push(o);
  });
  nodes.root.traverse((o) => {
    if (o.isMesh && (o.userData.hotspot === "platform" || o.userData.hotspot === "machinery" || o.name.startsWith("ACE_Tower_") || o.name === "ACE_NacelleShell_front")) plates.push(o);
  });
  const previous = new WeakMap();
  const coverPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -0.2);
  const worldCover = coverPlane.clone();
  const coverPlanes = [worldCover];
  return (active, room = false) => {
    nodes.yaw.updateWorldMatrix(true, false);
    worldCover.copy(coverPlane).applyMatrix4(nodes.yaw.matrixWorld);
    for (let i = 0; i < planes.length; i++) worldPlanes[i].copy(planes[i]).applyMatrix4(nodes.yaw.matrixWorld);
    for (const plate of plates) {
      const material = plate.material;
      if (active) {
        if (!previous.has(material)) {
          previous.set(material, { planes: material.clippingPlanes, intersection: material.clipIntersection });
          material.needsUpdate = true;
        }
        // Expose the existing copper coils when the visitor reaches the room.
        material.clippingPlanes = room && (plate.name === "ACE_NacelleInternals_1" || plate.name === "ACE_NacelleShell_front") ? coverPlanes : worldPlanes;
        material.clipIntersection = true;
      } else if (previous.has(material)) {
        const original = previous.get(material);
        material.clippingPlanes = original.planes;
        material.clipIntersection = original.intersection;
        material.needsUpdate = true;
        previous.delete(material);
      }
    }
  };
}
