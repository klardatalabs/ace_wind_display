// Procedural interior so "Look inside" has something worth seeing: ladder, service lift,
// platforms and cables in the tower; converter cabinets and transformer at the base;
// yaw ring + drives, main bearing and copper stator coils in the nacelle.
// Parts are tagged with userData.part so themes can style them, and label anchors are
// returned for the HUD.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { inspectable } from "./inspection.js";

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

function cabinetBody(width, height) {
  const cabinet = new THREE.Group();
  cabinet.add(box(width, height, .7, "cabinet", "cabinet"));
  const door = box(width - .11, height - .16, .035, "metal", "cabinet");
  door.position.z = .37;
  cabinet.add(door);
  const display = box(.3, .22, .04, "dark", "cabinet");
  display.position.set(-.1, height * .26, .405);
  cabinet.add(display);
  const handle = box(.035, .3, .05, "dark", "cabinet");
  handle.position.set(width * .32, .15, .42);
  cabinet.add(handle);
  for (let vent = 0; vent < 5; vent++) {
    const slat = box(width * .6, .025, .04, "dark", "cabinet");
    slat.position.set(0, -height * .28 + vent * .09, .405);
    cabinet.add(slat);
  }
  return cabinet;
}

function buildTower(explorer) {
  const g = new THREE.Group();
  g.name = "TowerInterior";

  // Ladder up the back wall (stays visible when the front half peels away).
  const rails = [-0.32, 0.32].map((x) => {
    const r = box(0.07, TOWER_TOP - 1, 0.07, "metal", "ladder");
    r.position.set(x, (TOWER_TOP + 1) / 2, -1.55);
    return r;
  });
  const ladder = inspectable(new THREE.Group(), "ladder", "tower", { continuous: true });
  ladder.name = "AccessLadder";
  ladder.add(...rails);
  g.add(ladder);
  const rungCount = Math.floor((TOWER_TOP - 2) / 0.6);
  const rungs = part(new THREE.InstancedMesh(geo.box, null, rungCount), "metal", "ladder");
  const m = new THREE.Matrix4();
  for (let i = 0; i < rungCount; i++) {
    m.compose(new THREE.Vector3(0, 1.4 + i * 0.6, -1.55), new THREE.Quaternion(), new THREE.Vector3(0.64, 0.05, 0.05));
    rungs.setMatrixAt(i, m);
  }
  ladder.add(rungs);

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
    p.name = `TowerPlatform_${y}`;
    inspectable(p, "platform", "tower", { anchor: [0, 0, r * .65], label: "Tower landing" });
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
  const powerCable = part(new THREE.Mesh(new THREE.TubeGeometry(cablePath, 80, 0.13, 8), null), "cable", "cable");
  inspectable(powerCable, "cable", "tower", { continuous: true });
  g.add(powerCable);

  // Service lift (animated by the scene).
  const lift = new THREE.Group();
  lift.name = "ServiceLift";
  inspectable(lift, "lift", "tower");
  if (explorer) {
    const deck = box(.9, .1, .9, "metal", "lift");
    lift.add(deck);
    for (const x of [-.43, .43]) for (const z of [-.43, .43]) {
      const post = box(.045, 1.8, .045, "metal", "lift");
      post.position.set(x, .9, z);
      lift.add(post);
    }
    for (const y of [.65, 1.2, 1.8]) {
      const rail = box(.9, .045, .045, "metal", "lift");
      rail.position.set(0, y, -.43);
      lift.add(rail);
      for (const x of [-.43, .43]) {
        const side = box(.045, .045, .9, "metal", "lift");
        side.position.set(x, y, 0);
        lift.add(side);
      }
    }
    const motor = box(.25, .35, .25, "dark", "lift");
    motor.position.set(.25, 1.55, -.3);
    lift.add(motor);
  } else {
    const cage = box(0.9, 1.3, 0.9, "accent", "lift");
    cage.position.y = 0.65;
    lift.add(cage);
  }
  lift.position.set(-0.8, 6, -0.6);
  g.add(lift);
  const liftCable = box(0.03, TOWER_TOP - 2, 0.03, "metal", "lift");
  liftCable.position.set(-0.8, TOWER_TOP / 2 + 1, -0.6);
  liftCable.userData.noPick = true;
  g.add(liftCable);

  // Converter cabinets at the tower base.
  [-1.1, -0.2, 0.7].forEach((x, i) => {
    const c = explorer ? cabinetBody(.8, 2) : box(0.8, 2, 0.7, "cabinet", "cabinet");
    c.position.set(x, 1.6, -1.2 + Math.abs(i - 1) * 0.25);
    c.name = `TowerConverter_${i + 1}`;
    inspectable(c, "converter", "tower", { label: `Converter cabinet ${i + 1}` });
    g.add(c);
  });

  return { group: g, lift, cablePath };
}

function buildNacelle(explorer) {
  const g = new THREE.Group();
  g.name = "NacelleInterior";

  // Yaw bearing ring + drives around it.
  const ring = part(new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.16, 10, 48), null), "accent", "yaw");
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.35;
  inspectable(ring, "yaw", "nacelle", { anchor: [-1.85, 0, 0] });
  g.add(ring);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const drive = cylinder(0.22, 1.1, "accent", "yaw");
    drive.position.set(Math.cos(a) * 1.45, 0.95, Math.sin(a) * 1.45);
    inspectable(drive, "yaw", "nacelle", { label: `Yaw drive ${i + 1}` });
    g.add(drive);
  }

  // Main bearing / axle journal toward the hub.
  const axle = cylinder(0.55, 2.2, "metal", "mainshaft");
  axle.rotation.z = Math.PI / 2;
  axle.position.set(1.5, 3, 0);
  const bearing = inspectable(new THREE.Group(), "mainshaft", "nacelle");
  bearing.name = "MainBearingAssembly";
  bearing.add(axle);
  if (explorer) {
    for (const x of [.5, 1.1]) {
      const flange = part(new THREE.Mesh(new THREE.TorusGeometry(.68, .12, 10, 40), null), "metal", "mainshaft");
      flange.rotation.y = Math.PI / 2;
      flange.position.set(x, 3, 0);
      bearing.add(flange);
      for (let i = 0; i < 12; i++) {
        const angle = i / 12 * Math.PI * 2;
        const bolt = cylinder(.045, .1, "dark", "mainshaft");
        bolt.rotation.z = Math.PI / 2;
        bolt.position.set(x - .1, 3 + Math.cos(angle) * .68, Math.sin(angle) * .68);
        bearing.add(bolt);
      }
    }
    const pedestal = box(.8, .55, 1.25, "metal", "mainshaft");
    pedestal.position.set(.8, 2.1, 0);
    bearing.add(pedestal);
  }
  g.add(bearing);

  // Stator: a ring of copper coils just outside the rotating generator.
  const coilCount = 48;
  const coilGeometry = explorer ? new RoundedBoxGeometry(1, 1, 1, 2, .12) : geo.box;
  const coils = part(new THREE.InstancedMesh(coilGeometry, null, coilCount), "copper", "stator");
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < coilCount; i++) {
    const a = (i / coilCount) * Math.PI * 2;
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
    m.compose(new THREE.Vector3(2.35, 3 + Math.cos(a) * 2.42, Math.sin(a) * 2.42), q, new THREE.Vector3(1.05, 0.16, 0.26));
    coils.setMatrixAt(i, m);
  }
  g.add(coils);
  inspectable(coils, "stator", "nacelle", { defaultInstance: 8, instanceLabel: "Winding" });
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
    const fan = inspectable(new THREE.Group(), "fans", "nacelle", { label: z < 0 ? "Cooling fan 1" : "Cooling fan 2" });
    fan.position.set(explorer ? -6.4 : -7.4, 3.6, z);
    const shroud = part(new THREE.Mesh(new THREE.TorusGeometry(.55, .07, 8, 32), null), "metal", "fans");
    shroud.rotation.y = Math.PI / 2;
    fan.add(shroud);
    const hub = cylinder(.13, .23, "dark", "fans");
    hub.rotation.z = Math.PI / 2;
    fan.add(hub);
    for (let i = 0; i < 5; i++) {
      const angle = i / 5 * Math.PI * 2;
      const blade = box(.05, .38, .17, "metal", "fans");
      blade.rotation.x = -angle;
      blade.position.set(0, Math.cos(angle) * .3, Math.sin(angle) * .3);
      fan.add(blade);
    }
    for (const offset of [-.3, 0, .3]) {
      const grille = box(.035, .035, .9, "dark", "fans");
      grille.position.set(.16, offset, 0);
      fan.add(grille);
    }
    g.add(fan);
  });

  if (explorer) {
    // Replace the merged glTF cabinet mesh with separate, selectable equipment.
    for (let i = 0; i < 3; i++) {
      const cabinet = inspectable(cabinetBody(1, 2.5), "control", "nacelle", { label: `Control cabinet ${i + 1}` });
      cabinet.name = `NacelleControl_${i + 1}`;
      cabinet.position.set(-5.25 + i * 1.15, 1.75, -1.85);
      g.add(cabinet);
    }
  }

  return g;
}

/**
 * @param {object} nodes from loadTurbine()
 * @param {THREE.Object3D} towerPivot  group that turns with the nacelle (holds tower halves)
 */
export function buildInteriors(nodes, towerPivot, { explorer = false } = {}) {
  const tower = buildTower(explorer);
  towerPivot.add(tower.group);
  const nacelle = buildNacelle(explorer);
  nodes.yaw.add(nacelle);
  if (explorer) {
    inspectable(nodes.generatorRotor, "generator", "nacelle");
    nodes.nacelleInternals.traverse(object => {
      if (["ACE_NacelleInternals_1", "ACE_NacelleInternals_2", "ACE_NacelleInternals_4"].includes(object.name)) object.visible = false;
      if (object.name === "ACE_NacelleInternals_3") inspectable(object, "yaw", "nacelle");
    });
  }

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
