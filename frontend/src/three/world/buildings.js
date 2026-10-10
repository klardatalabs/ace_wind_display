// The built environment: the Lawrence Weston estate (terraces and semis with gable roofs and
// windows that light up after dark), industrial units and a chimney stack along the coast,
// a solar farm, and a line of pylons carrying cables across the plain.

import * as THREE from "three";
import { rng, hash2 } from "./noise.js";
import { ZONES, ROAD, distToPolyline } from "./layout.js";

const mark = (o, hotspot) => {
  o.userData.world = true;
  if (hotspot) o.userData.hotspot = hotspot;
  o.frustumCulled = false;
  return o;
};

// ---------------------------------------------------------------- houses

function houseGeometry() {
  // body 5.6 wide (x) × 5 high × 8 deep (z), gable roof along z, small chimney
  const w = 5.6, h = 5, d = 8, roofH = 2.2;
  const body = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  body.translate(0, h / 2, 0);
  const roof = new THREE.BufferGeometry();
  const hw = w / 2 + 0.35, hd = d / 2 + 0.3;
  const v = [
    // two slopes
    [-hw, h, -hd], [0, h + roofH, -hd], [0, h + roofH, hd],
    [-hw, h, -hd], [0, h + roofH, hd], [-hw, h, hd],
    [hw, h, -hd], [0, h + roofH, hd], [0, h + roofH, -hd],
    [hw, h, -hd], [hw, h, hd], [0, h + roofH, hd],
    // gable ends
    [-w / 2, h, -d / 2], [w / 2, h, -d / 2], [0, h + roofH, -d / 2],
    [w / 2, h, d / 2], [-w / 2, h, d / 2], [0, h + roofH, d / 2],
  ];
  // Outward winding keeps both roof slopes visible with front-face materials.
  for (let i = 0; i < v.length; i += 3) [v[i + 1], v[i + 2]] = [v[i + 2], v[i + 1]];
  roof.setAttribute("position", new THREE.Float32BufferAttribute(v.flat(), 3));
  roof.computeVertexNormals();
  const chimney = new THREE.BoxGeometry(0.7, 1.8, 0.7).toNonIndexed();
  chimney.translate(1.2, h + roofH + 0.1, 1.5);

  const paint = (geo, fn) => {
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) col.set(fn(pos.getX(i), pos.getY(i), pos.getZ(i)), i * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return geo;
  };
  // walls white (tinted per instance); roof/chimney carry their own colour via vertex colour
  paint(body, () => [1, 1, 1]);
  paint(roof, () => [0.36, 0.2, 0.17]);
  paint(chimney, () => [0.45, 0.25, 0.2]);
  const parts = [body, roof, chimney];
  const merged = new THREE.BufferGeometry();
  const pos = [], col = [];
  for (const g of parts) {
    const p = g.attributes.position, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      col.push(c.getX(i), c.getY(i), c.getZ(i));
    }
  }
  merged.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  merged.computeVertexNormals();
  return merged;
}

const WALLS = [0xd9cdb8, 0xb8704f, 0xcfc4ae, 0x9c5a44, 0xe3dccb, 0xbfa88a, 0x8f5b47];

export function buildEstate() {
  const { x0, x1, z0, z1 } = ZONES.estate;
  const rand = rng(404);
  const houses = [];
  for (let sz = z0 + 64; sz < z1 - 40; sz += 64) {
    for (const [off, faceSouth] of [[10.5, true], [-10.5, false]]) {
      const z = sz + off;
      for (let x = x0 + 12; x < x1 - 12; x += 8.6) {
        const mx = (x - x0) % 210;
        if (mx < 9 || mx > 201) continue; // cross streets
        if (rand() < 0.04) continue; // a gap, a garage, a patch of garden
        houses.push({ x: x + (rand() - 0.5) * 0.3, z, rot: faceSouth ? 0 : Math.PI, tint: WALLS[Math.floor(rand() * WALLS.length)], rand: rand() });
      }
    }
  }

  const geometry = houseGeometry();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const mesh = new THREE.InstancedMesh(geometry, material, houses.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
  houses.forEach((h, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.rot);
    s.set(1, 0.92 + 0.2 * h.rand, 1);
    m.compose(p.set(h.x, 0, h.z), q, s);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.set(h.tint));
  });
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mark(mesh, "estate");

  // windows: 4 small quads per house, 2 on each long side — lit or dark per house
  const windowGeo = new THREE.PlaneGeometry(1.1, 1.3);
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
  const windows = new THREE.InstancedMesh(windowGeo, windowMat, houses.length * 4);
  const spots = [[-1.4, 1.6, 1], [1.4, 1.6, 1], [-1.4, 1.6, -1], [1.4, 1.6, -1]];
  const q2 = new THREE.Quaternion();
  houses.forEach((h, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.rot);
    spots.forEach(([lx, ly, side], k) => {
      const local = new THREE.Vector3(lx, ly + 0.9, side * 4.02);
      local.applyQuaternion(q);
      q2.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.rot + (side > 0 ? 0 : Math.PI));
      m.compose(p.set(h.x + local.x, local.y, h.z + local.z), q2, s.set(1, 1, 1));
      windows.setMatrixAt(i * 4 + k, m);
    });
  });
  windows.instanceMatrix.needsUpdate = true;
  windows.setColorAt(0, c.set(0x000000));
  mark(windows, "estate");

  const states = houses.map((h, i) => hash2(i, 91)); // each house's fixed position in the "lights on" order
  let lastKey = "";
  /** @param {number} litFraction share of homes with the lights on, @param {number} night 0..1 */
  const setLights = (litFraction, night) => {
    const key = `${litFraction.toFixed(3)}|${night.toFixed(2)}`;
    if (key === lastKey) return;
    lastKey = key;
    const dark = new THREE.Color(0x1c2430), warm = new THREE.Color(0xffc477), glassDay = new THREE.Color(0x5d7488);
    const tmp = new THREE.Color();
    houses.forEach((h, i) => {
      const on = states[i] < litFraction;
      for (let k = 0; k < 4; k++) {
        if (on && night > 0.05) tmp.copy(warm).multiplyScalar(0.25 + 1.1 * night * (0.7 + 0.3 * hash2(i, k)));
        else tmp.copy(dark).lerp(glassDay, 1 - night);
        windows.setColorAt(i * 4 + k, tmp);
      }
    });
    windows.instanceColor.needsUpdate = true;
  };
  setLights(0.5, 0);

  const group = new THREE.Group();
  group.name = "Estate";
  group.add(mesh, windows);
  return { group, setLights, houseCount: houses.length, houses };
}

// ---------------------------------------------------------------- industrial

export function buildIndustrial() {
  const { x0, x1, z0, z1 } = ZONES.industrial;
  const rand = rng(909);
  const group = new THREE.Group();
  group.name = "Industrial";

  const sheds = [];
  for (let gz = z0 + 40; gz < z1 - 40; gz += 120) {
    for (let gx = x0 + 40; gx < x1 - 40; gx += 150) {
      if (rand() < 0.2) continue;
      sheds.push({ x: gx + (rand() - 0.5) * 30, z: gz + (rand() - 0.5) * 30, w: 55 + rand() * 60, d: 38 + rand() * 40, h: 11 + rand() * 8, rot: Math.round(rand()) * Math.PI / 2 });
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  box.translate(0, 0.5, 0);
  const cladding = [0xc9ced1, 0xaab3b8, 0x9db2c4, 0xd8d6cf, 0x8fa39a, 0xb9c2c7];
  const shedMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.3 });
  const shedMesh = new THREE.InstancedMesh(box, shedMat, sheds.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  sheds.forEach((s, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot);
    m.compose(new THREE.Vector3(s.x, 0, s.z), q, new THREE.Vector3(s.w, s.h, s.d));
    shedMesh.setMatrixAt(i, m);
    shedMesh.setColorAt(i, c.set(cladding[Math.floor(rand() * cladding.length)]));
  });
  mark(shedMesh, "industrial");

  // low-pitched roofs: a slightly darker flat slab on top of each shed
  const roofMesh = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: 0x70767a, roughness: 0.8 }), sheds.length);
  sheds.forEach((s, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot);
    m.compose(new THREE.Vector3(s.x, s.h, s.z), q, new THREE.Vector3(s.w * 1.01, 0.5, s.d * 1.01));
    roofMesh.setMatrixAt(i, m);
  });
  mark(roofMesh, "industrial");

  // storage tanks
  const tankGeo = new THREE.CylinderGeometry(1, 1, 1, 24).toNonIndexed();
  tankGeo.translate(0, 0.5, 0);
  const tanks = new THREE.InstancedMesh(tankGeo, new THREE.MeshStandardMaterial({ color: 0xe4e6e3, roughness: 0.4, metalness: 0.5 }), 14);
  for (let i = 0; i < 14; i++) {
    const r = 6 + rand() * 7;
    m.compose(new THREE.Vector3(x0 + 60 + (i % 7) * 34 + rand() * 6, 0, z0 + 20 + Math.floor(i / 7) * 36), new THREE.Quaternion(), new THREE.Vector3(r, 9 + rand() * 9, r));
    tanks.setMatrixAt(i, m);
  }
  mark(tanks, "industrial");

  // shipping containers stacked in the yards
  const containers = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.3 }), 220);
  const cCols = [0xb23a2f, 0x2f5d8c, 0xd9a02c, 0x3d7a4a, 0xbfc4c8, 0x8a4b2a];
  for (let i = 0; i < 220; i++) {
    const col = i % 22, row = Math.floor(i / 22);
    m.compose(new THREE.Vector3(x0 + 20 + col * 3.1 + (row % 2) * 90, Math.floor(rand() * 3) * 2.6, z1 - 60 + row * 6), new THREE.Quaternion(), new THREE.Vector3(2.5, 2.6, 12));
    containers.setMatrixAt(i, m);
    containers.setColorAt(i, c.set(cCols[Math.floor(rand() * cCols.length)]));
  }
  mark(containers, "industrial");

  // a tall chimney stack with red-and-white bands (aircraft warning paint)
  const stackGeo = new THREE.CylinderGeometry(2.2, 3.6, 95, 16, 10, true).toNonIndexed();
  const sp = stackGeo.attributes.position, sc = new Float32Array(sp.count * 3);
  for (let i = 0; i < sp.count; i++) {
    const band = Math.floor((sp.getY(i) + 47.5) / 9.5) % 2;
    sc.set(band ? [0.82, 0.16, 0.12] : [0.92, 0.92, 0.9], i * 3);
  }
  stackGeo.setAttribute("color", new THREE.BufferAttribute(sc, 3));
  const stack = new THREE.Mesh(stackGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  stack.position.set(x1 - 60, 47.5, z0 + 70);
  mark(stack, "chimney");

  group.add(shedMesh, roofMesh, tanks, containers, stack);
  return { group, stackTop: new THREE.Vector3(x1 - 60, 96, z0 + 70) };
}

// ---------------------------------------------------------------- solar farm

export function buildSolarFarm() {
  const { x0, x1, z0, z1 } = ZONES.solar;
  const spacing = 7.5;
  const panelW = 4.2, panelD = 5.4;
  const rows = Math.floor((z1 - z0 - 20) / spacing);
  const cols = Math.floor((x1 - x0 - 20) / (panelW + 0.2));
  const count = rows * cols;
  const geo = new THREE.BoxGeometry(panelW, 0.06, panelD).toNonIndexed();
  const mat = new THREE.MeshStandardMaterial({ color: 0x14233f, roughness: 0.22, metalness: 0.7 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.43), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      m.compose(p.set(x0 + 10 + c * (panelW + 0.2), 1.5, z0 + 10 + r * spacing), q, s);
      mesh.setMatrixAt(i++, m);
    }
  }
  mark(mesh, "solar");
  const group = new THREE.Group();
  group.name = "SolarFarm";
  group.add(mesh);
  return { group };
}

// ---------------------------------------------------------------- pylons and cables

export function buildPylons() {
  const group = new THREE.Group();
  group.name = "Pylons";
  const a = new THREE.Vector3(-900, 0, -260);
  const b = new THREE.Vector3(1700, 0, -480);
  const dir = b.clone().sub(a);
  const length = dir.length();
  dir.normalize();
  const spacing = 300;
  const count = Math.floor(length / spacing) + 1;
  const h = 46;
  const legGeo = new THREE.BoxGeometry(0.7, h, 0.7).toNonIndexed();
  legGeo.translate(0, h / 2, 0);
  const armGeo = new THREE.BoxGeometry(22, 0.6, 0.6).toNonIndexed();
  const mat = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.6, metalness: 0.6 });
  const legs = new THREE.InstancedMesh(legGeo, mat, count * 4);
  const arms = new THREE.InstancedMesh(armGeo, mat, count * 3);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const yaw = Math.atan2(-dir.z, dir.x);
  const tops = [];
  for (let i = 0; i < count; i++) {
    const base = a.clone().addScaledVector(dir, i * spacing);
    for (let k = 0; k < 4; k++) {
      // four legs at the corners of a 4.8 m square, turned to follow the line of pylons
      const lx = (k & 1 ? 1 : -1) * 2.4;
      const lz = (k & 2 ? 1 : -1) * 2.4;
      const wx = lx * Math.cos(yaw) + lz * Math.sin(yaw);
      const wz = -lx * Math.sin(yaw) + lz * Math.cos(yaw);
      m.compose(new THREE.Vector3(base.x + wx, 0, base.z + wz), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      legs.setMatrixAt(i * 4 + k, m);
    }
    for (let k = 0; k < 3; k++) {
      q.setFromEuler(e.set(0, yaw + Math.PI / 2, 0));
      m.compose(new THREE.Vector3(base.x, 30 + k * 7, base.z), q, new THREE.Vector3(1 - k * 0.2, 1, 1));
      arms.setMatrixAt(i * 3 + k, m);
    }
    tops.push(base);
  }
  mark(legs, "pylons"); mark(arms, "pylons");

  // sagging cables between pylons (a parabola, three per side)
  const points = [];
  const energyRoute = [];
  for (let i = 0; i < count - 1; i++) {
    for (const side of [-1, 0, 1]) {
      const h0 = 32 + (side + 1) * 7;
      const off = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(side * 9 * (1 - (side + 1) * 0.1));
      let prev = null;
      for (let s = 0; s <= 12; s++) {
        const t = s / 12;
        const pos = a.clone().addScaledVector(dir, (i + t) * spacing).add(off);
        pos.y = h0 - 7 * 4 * t * (1 - t);
        if (side === 0 && (s > 0 || i === 0)) energyRoute.push(pos.clone());
        if (prev) points.push(prev.x, prev.y, prev.z, pos.x, pos.y, pos.z);
        prev = pos;
      }
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x2a3036 }));
  mark(lines, "pylons");
  group.add(legs, arms, lines);
  return { group, energyRoute, tops };
}
