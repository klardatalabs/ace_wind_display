// Trees: woods in the woodland parcels, hedgerow trees along field borders, poplars beside
// the road, and the odd tree standing alone in a field. Thousands of instances, a handful
// of draw calls, swaying with the real wind. Positions come from the same land-cover rules
// the ground shader uses, so the trees stand where the ground says there is woodland.

import * as THREE from "three";
import { rng, hash2, fbm } from "./noise.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { landCoverAt, treeFree, distToPolyline, ROAD, LC, OPEN_FIELD } from "./layout.js";

const MAX_TREES = 15000;
const NEAR_RADIUS = 380;

// ---------------------------------------------------------------- geometry

function colourGeometry(geometry, fn) {
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    fn(c, pos.getX(i), pos.getY(i), pos.getZ(i));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function merge(parts) {
  const positions = [];
  const colors = [];
  const indices = [];
  let offset = 0;
  for (const g of parts) {
    const geo = g.index ? g : g;
    const pos = geo.attributes.position;
    const col = geo.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      colors.push(col.getX(i), col.getY(i), col.getZ(i));
    }
    if (geo.index) for (const idx of geo.index.array) indices.push(idx + offset);
    else for (let i = 0; i < pos.count; i++) indices.push(i + offset);
    offset += pos.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}

/** A lumpy canopy blob: an icosahedron with its vertices pushed about, coloured dark below, light on top. */
function blob(radius, x, y, z, seed, hueShift = 0) {
  const g = new THREE.IcosahedronGeometry(radius, 1);
  const r = rng(seed);
  const pos = g.attributes.position;
  const jitter = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!jitter.has(key)) jitter.set(key, 0.78 + 0.5 * r());
    const k = jitter.get(key);
    pos.setXYZ(i, pos.getX(i) * k + x, pos.getY(i) * (0.82 * k) + y, pos.getZ(i) * k + z);
  }
  // weld the corners so the canopy shades smoothly instead of in flat facets
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const smooth = mergeVertices(g, 0.01);
  smooth.computeVertexNormals();
  return colourGeometry(smooth, (c, px, py, pz) => {
    const t = THREE.MathUtils.clamp((py - (y - radius)) / (radius * 2), 0, 1);
    const n = fbm(px * 0.9 + 3, pz * 0.9 + py * 0.5, 2);
    c.setHSL(0.24 + hueShift + 0.05 * n, 0.4 + 0.12 * n, 0.065 + 0.14 * t + 0.06 * n);
  });
}

function trunk(height, radius) {
  const g = new THREE.CylinderGeometry(radius * 0.6, radius, height, 5, 1).toNonIndexed();
  g.translate(0, height / 2, 0);
  return colourGeometry(g, (c, px, py) => c.setHSL(0.07, 0.3, 0.16 + 0.08 * (py / height)));
}

function broadleafNear() {
  return merge([trunk(3.4, 0.34), blob(2.7, 0, 6.2, 0, 11), blob(2.1, 1.7, 5.2, 0.6, 12), blob(2.2, -1.5, 5.4, -0.9, 13), blob(1.9, 0.4, 7.7, 0.7, 14), blob(1.8, -0.3, 5.1, 1.7, 15)]);
}

function broadleafFar() {
  return merge([blob(3.3, 0, 5.4, 0, 21), blob(2.4, 1.6, 4.6, 0.5, 22)]);
}

function poplar() {
  const parts = [trunk(2.5, 0.28)];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.ConeGeometry(1.5 - i * 0.22, 5.2, 7, 1).toNonIndexed();
    g.translate(0, 4.4 + i * 3.1, 0);
    parts.push(colourGeometry(g, (c, px, py) => c.setHSL(0.25, 0.45, 0.14 + 0.025 * i + 0.05 * Math.sin(px * 3 + py))));
  }
  return merge(parts);
}

// ---------------------------------------------------------------- placement

function scatter() {
  const rand = rng(77);
  const grid = new Map();
  const cell = 14;
  const trees = [];

  const free = (x, z, minDist) => {
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    const reach = Math.ceil(minDist / cell);
    for (let j = -reach; j <= reach; j++) {
      for (let i = -reach; i <= reach; i++) {
        const list = grid.get(`${cx + i},${cz + j}`);
        if (list) for (const t of list) if (Math.hypot(t.x - x, t.z - z) < Math.max(minDist, t.minDist * 0.8)) return false;
      }
    }
    return true;
  };
  const add = (x, z, scale, kind, minDist) => {
    const t = { x, z, scale, kind, minDist, rot: rand() * 6.28 };
    trees.push(t);
    const key = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(t);
  };

  // woods, hedgerow trees, scattered field trees
  for (let attempt = 0; attempt < 300000 && trees.length < MAX_TREES; attempt++) {
    const r = OPEN_FIELD + 2800 * Math.pow(rand(), 2.2);
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (treeFree(x, z)) continue;
    const spacing = 7 + r / 70; // trees get bigger and sparser with distance
    const lc = landCoverAt(x, z);
    let accept = false;
    let minDist = spacing * 0.75;
    let kind = rand() < 0.07 ? "poplar" : "broad";
    if (lc.cls === LC.WOOD) accept = true;
    else if (lc.hedge > 0.55 && lc.cls !== LC.GARDEN) {
      accept = rand() < 0.3;
      minDist = spacing * 1.2;
    } else if (lc.cls === LC.PASTURE || lc.cls === LC.MEADOW) accept = rand() < 0.0035;
    if (!accept || !free(x, z, minDist)) continue;
    add(x, z, (0.8 + 0.55 * rand()) * (spacing / 10 + 0.55), kind, minDist);
  }

  // poplars and oaks lining the road
  for (let i = 1; i < ROAD.length; i++) {
    const [ax, az] = ROAD[i - 1];
    const [bx, bz] = ROAD[i];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    for (let s = 0; s < len; s += 15 + rand() * 9) {
      for (const side of [-1, 1]) {
        if (rand() < 0.4) continue;
        const off = side * (12.5 + rand() * 3);
        const x = ax + ((bx - ax) * s) / len + nx * off;
        const z = az + ((bz - az) * s) / len + nz * off;
        if (treeFree(x, z) && distToPolyline(ROAD, x, z) > 10 && free(x, z, 7)) add(x, z, 0.9 + 0.5 * rand(), rand() < 0.5 ? "poplar" : "broad", 7);
      }
    }
  }
  return trees;
}

// ---------------------------------------------------------------- meshes

function instanced(geometry, items, material) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  items.forEach((t, i) => {
    const ground = t.y ?? 0;
    p.set(t.x, ground - 0.2, t.z);
    q.setFromEuler(e.set((hash2(i, 3) - 0.5) * 0.06, t.rot, (hash2(i, 5) - 0.5) * 0.06));
    const stretch = 0.9 + 0.3 * hash2(i, 9);
    s.set(t.scale, t.scale * stretch, t.scale);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    // per-tree tint: some greener, some yellower, some darker
    const v = hash2(i, 11);
    c.setHSL(0.02 * (v - 0.5), 0.15 * (hash2(i, 13) - 0.5), 1 + 0.4 * (hash2(i, 17) - 0.5));
    c.setRGB(0.78 + 0.4 * v, 0.84 + 0.3 * hash2(i, 13), 0.7 + 0.3 * hash2(i, 17));
    mesh.setColorAt(i, c);
  });
  mesh.count = items.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.world = true;
  mesh.frustumCulled = false;
  return mesh;
}

export function buildTrees(groundHeight) {
  const uniforms = { uTime: { value: 0 }, uSway: { value: 0.3 }, uNight: { value: 0 } };
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uSway;\nvarying vec3 vTreeWorld;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float ph = ip.x * 0.11 + ip.z * 0.13;
        float gust = sin(uTime * 1.1 + ph) + 0.5 * sin(uTime * 2.3 + ph * 1.7);
        float hgt = max(position.y, 0.0);
        transformed.x += gust * uSway * 0.018 * pow(hgt, 1.6);
        transformed.z += gust * uSway * 0.01 * pow(hgt, 1.6);
        // a tree that the camera is about to fly into shrinks away instead of blocking the view
        transformed *= smoothstep(9.0, 38.0, distance(cameraPosition, ip + modelMatrix[3].xyz));
        #endif
        vTreeWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTreeWorld;\nfloat tn(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        // leaf-scale speckle so canopies read as foliage, not smooth blobs
        float leaf = tn(floor(vTreeWorld * 1.6));
        diffuseColor.rgb *= 0.82 + 0.34 * leaf;`
      );
  };
  material.customProgramCacheKey = () => "ww-trees";

  const all = scatter().map((t) => ({ ...t, y: groundHeight(t.x, t.z) }));
  const poplars = all.filter((t) => t.kind === "poplar");
  const near = all.filter((t) => t.kind === "broad" && Math.hypot(t.x, t.z) < NEAR_RADIUS);
  const far = all.filter((t) => t.kind === "broad" && Math.hypot(t.x, t.z) >= NEAR_RADIUS);

  const group = new THREE.Group();
  group.name = "Trees";
  group.add(instanced(broadleafNear(), near, material), instanced(broadleafFar(), far, material), instanced(poplar(), poplars, material));
  group.userData.world = true;
  group.userData.hotspot = "woodland";
  return { group, uniforms, count: all.length };
}
