// The layout of the place, in metres around the turbine (+x east, +z south, estuary to the
// west). It is a representative Lawrence Weston / Avonmouth, not a survey: a main road, the
// Lawrence Weston estate to the north-east, industrial units and docks along the coast to
// the north, a solar farm to the south, and fields, hedges and woods everywhere else.

import * as THREE from "three";
import { hash2, shoreX, smoothstep, clamp } from "./noise.js";

export const EXTENT = 5120; // land-cover map covers ±2560 m and tiles beyond that
export const MAP = 1024;

// Main road passing ~220 m south-east of the turbine (polyline, metres).
export const ROAD = [
  [-760, 330], [-470, 300], [-210, 240], [30, 230], [250, 175], [520, 60], [790, -110], [1100, -190], [1500, -190],
];
// Gravel access track from the road to the turbine pad.
export const TRACK = [[30, 230], [24, 140], [8, 70], [0, 22]];

export const ZONES = {
  estate: { x0: 330, x1: 960, z0: -900, z1: -330 },
  industrial: { x0: -430, x1: 230, z0: -1180, z1: -540 },
  solar: { x0: 300, x1: 560, z0: 330, z1: 600 },
};

const inRect = (r, x, z, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
export const inZone = (name, x, z, pad = 0) => inRect(ZONES[name], x, z, pad);

/** Distance from a point to a polyline. */
export function distToPolyline(line, x, z) {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1];
    const [bx, bz] = line[i];
    const dx = bx - ax;
    const dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

// Land-cover classes (red channel of the map)
export const LC = { PASTURE: 0, CROP: 1, PLOUGH: 2, MEADOW: 3, WOOD: 4, GARDEN: 5, INDUSTRIAL: 6, SOLAR: 7 };

/** Radius of the open field around the turbine where no trees or hedges grow. */
export const OPEN_FIELD = 55;

const CELL = 190; // typical field size, metres

function voronoi(x, z) {
  const gx = x / CELL;
  const gz = z / CELL;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  let f1 = 9;
  let f2 = 9;
  let id = 0;
  let cxBest = 0;
  let czBest = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = ix + i;
      const cz = iz + j;
      const px = cx + 0.1 + 0.8 * hash2(cx, cz);
      const pz = cz + 0.1 + 0.8 * hash2(cx + 91, cz - 37);
      const d = Math.hypot(px - gx, pz - gz);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash2(cx + 7, cz + 13);
        cxBest = px * CELL;
        czBest = pz * CELL;
      } else if (d < f2) f2 = d;
    }
  }
  return { f1, f2, id, cx: cxBest, cz: czBest };
}

/** Land cover at a world point: { cls, rand, hedge } (hedge 0..1 along field borders). */
export function landCoverAt(x, z) {
  const r = Math.hypot(x, z);
  const { f1, f2, id, cx, cz } = voronoi(x, z);
  const edge = f2 - f1; // small on field borders
  let cls;
  // The fields around the turbine are open farmland (pasture, crops, meadow), never woods,
  // so it stands in a natural patchwork of hedged fields rather than a circular clearing.
  if (Math.hypot(cx, cz) < 330) cls = id < 0.55 ? LC.PASTURE : id < 0.8 ? LC.CROP : LC.MEADOW;
  else if (id < 0.34) cls = LC.PASTURE;
  else if (id < 0.52) cls = LC.CROP;
  else if (id < 0.62) cls = LC.PLOUGH;
  else if (id < 0.74) cls = LC.MEADOW;
  else cls = LC.WOOD;
  let hedge = r < OPEN_FIELD ? 0 : 1 - smoothstep(0.012, 0.045, edge);
  if (cls === LC.WOOD) hedge *= 0.3;

  if (inZone("estate", x, z)) { cls = LC.GARDEN; hedge = 0; }
  else if (inZone("industrial", x, z)) { cls = LC.INDUSTRIAL; hedge = 0; }
  else if (inZone("solar", x, z)) { cls = LC.SOLAR; hedge = hedge * 0.5; }
  return { cls, rand: hash2(Math.floor(x / 31), Math.floor(z / 31)) * 0.3 + id * 0.7, hedge };
}

/** Bake the land-cover map: R = class, G = random, B = hedge strength. */
export function buildLandCoverTexture() {
  const data = new Uint8Array(MAP * MAP * 4);
  for (let j = 0; j < MAP; j++) {
    for (let i = 0; i < MAP; i++) {
      const x = ((i + 0.5) / MAP - 0.5) * EXTENT;
      const z = ((j + 0.5) / MAP - 0.5) * EXTENT;
      const lc = landCoverAt(x, z);
      const o = (j * MAP + i) * 4;
      data[o] = lc.cls;
      data[o + 1] = Math.round(lc.rand * 255);
      data[o + 2] = Math.round(lc.hedge * 255);
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, MAP, MAP, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.NearestFilter; // classes must not blend
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** True where something large (road, track, pad, buildings, water) means no trees. */
export function treeFree(x, z) {
  const r = Math.hypot(x, z);
  if (r < OPEN_FIELD) return true; // an open field round the turbine (and its camera shots)
  if (distToPolyline(ROAD, x, z) < 11) return true;
  if (distToPolyline(TRACK, x, z) < 8) return true;
  if (x < shoreX(z) + 55) return true; // sea wall, mud and water
  if (inZone("industrial", x, z) || inZone("solar", x, z)) return true;
  return false;
}
