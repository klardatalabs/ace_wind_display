// A low-poly stand-in for the land around the turbine, used by the cartoon and blueprint
// looks (and by the realistic look until the Lawrence Weston scan has streamed in):
// fields, the Severn Estuary, a road, rows of houses on the estate and scattered trees.
// Everything is instanced so the whole landscape costs a handful of draw calls.

import * as THREE from "three";

// Small seeded PRNG so every screen draws the same landscape.
function random(seed = 7) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tag(mesh, part, { receive = false } = {}) {
  mesh.userData.part = part;
  mesh.userData.landscape = true;
  mesh.castShadow = false;
  mesh.receiveShadow = receive;
  mesh.raycast = () => {};
  return mesh;
}

const ESTUARY_EDGE = -620; // x beyond which the estuary starts (west of the turbine)
const ROAD_Z = 60;
const ESTATE = { x0: 260, x1: 720, z0: -760, z1: -260 };

function inEstate(x, z, pad = 0) {
  return x > ESTATE.x0 - pad && x < ESTATE.x1 + pad && z > ESTATE.z0 - pad && z < ESTATE.z1 + pad;
}

function buildHouses(rand) {
  const spots = [];
  for (let z = ESTATE.z0; z < ESTATE.z1; z += 34) {
    for (let x = ESTATE.x0; x < ESTATE.x1; x += 13) {
      if (rand() < 0.16) continue; // gaps between terraces
      spots.push({ x: x + rand() * 2, z: z + rand() * 3, h: 6 + rand() * 2.5 });
    }
  }
  const walls = tag(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), null, spots.length), "house");
  const roofGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1);
  roofGeo.rotateX(Math.PI / 2); // triangular prism lying along z
  roofGeo.rotateZ(Math.PI / 2);
  const roofs = tag(new THREE.InstancedMesh(roofGeo, null, spots.length), "roof");
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  spots.forEach((s, i) => {
    m.compose(new THREE.Vector3(s.x, s.h / 2, s.z), q, new THREE.Vector3(11, s.h, 9));
    walls.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(s.x, s.h + 1.4, s.z), q, new THREE.Vector3(11.4, 3.2, 10.6));
    roofs.setMatrixAt(i, m);
  });
  return [walls, roofs];
}

function buildTrees(rand, count = 520) {
  const trunks = tag(new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1, 6), null, count), "trunk");
  const crowns = tag(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), null, count), "tree");
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let i = 0;
  let guard = 0;
  while (i < count && guard++ < count * 20) {
    // Denser near the turbine site, thinning out toward the horizon.
    const r = 45 + Math.pow(rand(), 1.6) * 1500;
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (x < ESTUARY_EDGE + 30 || inEstate(x, z, 12) || Math.abs(z - ROAD_Z) < 10) continue;
    const h = 5 + rand() * 9;
    const w = h * (0.35 + rand() * 0.2);
    m.compose(new THREE.Vector3(x, h * 0.3, z), q, new THREE.Vector3(1, h * 0.6, 1));
    trunks.setMatrixAt(i, m);
    q.setFromEuler(e.set(rand(), rand() * Math.PI, rand()));
    m.compose(new THREE.Vector3(x, h * 0.72, z), q, new THREE.Vector3(w, h * 0.42, w));
    crowns.setMatrixAt(i, m);
    q.identity();
    i++;
  }
  trunks.count = crowns.count = i;
  return [trunks, crowns];
}

export function buildLandscape() {
  const group = new THREE.Group();
  group.name = "Landscape";
  const rand = random(2023); // the year the turbine was commissioned

  const ground = tag(new THREE.Mesh(new THREE.CircleGeometry(3200, 64), null), "grass", { receive: true });
  ground.rotation.x = -Math.PI / 2;
  ground.name = "Ground";
  group.add(ground);

  const estuary = tag(new THREE.Mesh(new THREE.PlaneGeometry(2600, 6400), null), "water");
  estuary.rotation.x = -Math.PI / 2;
  estuary.position.set(ESTUARY_EDGE - 1300, 0.15, 0);
  group.add(estuary);

  const road = tag(new THREE.Mesh(new THREE.PlaneGeometry(3000, 7), null), "road", { receive: true });
  road.rotation.x = -Math.PI / 2;
  road.position.set(900, 0.08, ROAD_Z);
  group.add(road);

  const track = tag(new THREE.Mesh(new THREE.PlaneGeometry(4.5, ROAD_Z), null), "road", { receive: true });
  track.rotation.x = -Math.PI / 2;
  track.position.set(0, 0.09, ROAD_Z / 2);
  group.add(track);

  group.add(...buildHouses(rand), ...buildTrees(rand));
  return group;
}
