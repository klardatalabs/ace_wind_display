// The ground. One mesh (a polar grid: fine near the turbine, coarse towards the horizon)
// with a shader that paints fields, hedges, woodland floor, roads, the access track, the
// mud flats and moving cloud shadows from the land-cover map — so nothing is a flat colour.

import * as THREE from "three";
import { terrainHeight, GLSL_NOISE } from "./noise.js";
import { buildLandCoverTexture, EXTENT, MAP, ROAD, TRACK, ZONES, LC } from "./layout.js";

const RINGS = 150;
const SEGMENTS = 220;
const R_MIN = 2;
const R_MAX = 9500;

export function buildTerrainGeometry() {
  const growth = Math.pow(R_MAX / R_MIN, 1 / (RINGS - 1));
  const positions = new Float32Array((RINGS + 1) * (SEGMENTS + 1) * 3);
  let p = 0;
  for (let k = 0; k <= RINGS; k++) {
    const r = k === 0 ? 0 : R_MIN * Math.pow(growth, k - 1);
    for (let s = 0; s <= SEGMENTS; s++) {
      const a = (s / SEGMENTS) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      positions[p++] = x;
      positions[p++] = terrainHeight(x, z);
      positions[p++] = z;
    }
  }
  const indices = [];
  const row = SEGMENTS + 1;
  for (let k = 0; k < RINGS; k++) {
    for (let s = 0; s < SEGMENTS; s++) {
      const a = k * row + s;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, b, c, b, d, c); // counter-clockwise seen from above, so the faces point up
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const C = (hex) => {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
};

// Two colours per land-cover class; the map's random channel picks between them.
const CLASS_COLORS = [
  [0x56802f, 0x749439], // pasture
  [0xc5b44c, 0x8da23f], // crop: ripe wheat / green barley
  [0x7a6245, 0x65502f], // ploughed
  [0x8b9d4c, 0x9aa756], // meadow
  [0x394b2a, 0x2f4224], // wood floor
  [0x628f3a, 0x729b43], // garden lawns
  [0x9a9d9a, 0x8a8d8c], // industrial hardstanding
  [0x7d9a4a, 0x6e8d3f], // solar farm grass
];

const MAX_PTS = 12;

const FRAGMENT_COMMON = /* glsl */ `
uniform sampler2D uLandCover;
uniform float uExtent;
uniform float uMapSize;
uniform float uTime;
uniform vec2 uWind;
uniform float uCloudShadow;
uniform float uWet;
uniform vec3 uColA[8];
uniform vec3 uColB[8];
uniform vec2 uRoad[${MAX_PTS}];
uniform int uRoadN;
uniform vec2 uTrack[${MAX_PTS}];
uniform int uTrackN;
uniform vec4 uEstate;
varying vec3 vWorld;
${GLSL_NOISE}
vec3 wwClassColour(vec4 l){
  int c = int(l.r * 255.0 + 0.5);
  return mix(uColA[c], uColB[c], l.g);
}
float wwSegDist(vec2 p, vec2 a, vec2 b, out float along){
  vec2 ab = b - a; float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  along = t * length(ab);
  return length(p - (a + ab * t));
}
`;

const FRAGMENT_ALBEDO = /* glsl */ `
vec2 wp = vWorld.xz;
float camDist = length(vViewPosition);
vec2 warp = (vec2(wwNoise(wp * 0.045), wwNoise(wp * 0.045 + 31.7)) - 0.5) * 16.0;
// The land-cover map is ~5 m a pixel and its classes can't be filtered, so reading one pixel
// gives stair-stepped borders. Instead, blend the colours of the four nearest pixels, with a
// finer wobble so field edges and hedges wander like real ones.
vec2 wobble = (vec2(wwNoise(wp * 0.31), wwNoise(wp * 0.31 + 17.0)) - 0.5) * 3.0;
vec2 lcT = ((wp + warp + wobble) / uExtent + 0.5) * uMapSize - 0.5;
vec2 lcI = floor(lcT);
vec2 lcF = smoothstep(0.15, 0.85, fract(lcT));
vec4 l00 = texture2D(uLandCover, (lcI + vec2(0.5, 0.5)) / uMapSize);
vec4 l10 = texture2D(uLandCover, (lcI + vec2(1.5, 0.5)) / uMapSize);
vec4 l01 = texture2D(uLandCover, (lcI + vec2(0.5, 1.5)) / uMapSize);
vec4 l11 = texture2D(uLandCover, (lcI + vec2(1.5, 1.5)) / uMapSize);
// The nearest pixel still decides each field's own patterns (rows, mowing, flowers).
vec4 lc = lcF.y < 0.5 ? (lcF.x < 0.5 ? l00 : l10) : (lcF.x < 0.5 ? l01 : l11);
int cls = int(lc.r * 255.0 + 0.5);
float rnd = lc.g;
float hedge = mix(mix(l00.b, l10.b, lcF.x), mix(l01.b, l11.b, lcF.x), lcF.y);

vec3 albedo = mix(mix(wwClassColour(l00), wwClassColour(l10), lcF.x), mix(wwClassColour(l01), wwClassColour(l11), lcF.x), lcF.y);
// clumps and bare patches: darker tussocks, drier yellow-brown spots
float clump = wwFbm(wp * 0.35 + 9.0);
albedo = mix(albedo, albedo * vec3(1.12, 1.02, 0.6), smoothstep(0.62, 0.78, clump) * 0.55);
albedo *= 0.88 + 0.24 * smoothstep(0.35, 0.6, clump);

float n1 = wwFbm(wp * 0.012);
float n2 = wwFbm(wp * 0.075);
float n3 = wwNoise(wp * 0.9);
float fadeFine = 1.0 - smoothstep(40.0, 260.0, camDist);
float n4 = wwNoise(wp * 3.3);
float n5 = wwNoise(wp * 11.0);
albedo *= (0.74 + 0.52 * n1) * (0.88 + 0.24 * n2) * (0.92 + 0.16 * n3 * fadeFine) * (0.93 + 0.14 * n4 * fadeFine) * (0.95 + 0.1 * n5 * fadeFine * fadeFine);
if (cls == 0 || cls == 5) albedo *= 0.97 + 0.03 * sin(dot(wp, vec2(0.6, 0.8)) * 0.35) * fadeFine; // faint mowing / grazing bands

// crops and ploughing: parallel rows, a different direction in every field
float ang = rnd * 6.2831;
float rows = dot(wp, vec2(cos(ang), sin(ang)));
if (cls == 1) albedo *= 0.94 + 0.06 * sin(rows * 2.4) * fadeFine + 0.05 * sin(rows * 0.31);
if (cls == 2) albedo *= 0.86 + 0.14 * sin(rows * 5.0) * fadeFine;
// flowers and clover speckle in the meadows
if (cls == 3) albedo = mix(albedo, vec3(0.62, 0.55, 0.16), step(0.93, wwNoise(wp * 0.55)) * 0.55 * fadeFine);
// hedgerows along field borders
albedo = mix(albedo, vec3(0.045, 0.1, 0.03) * (0.8 + 0.5 * n2), hedge * 0.9);

// the estate: streets every 64 m, a cross street every 210 m
if (wp.x > uEstate.x && wp.x < uEstate.z && wp.y > uEstate.y && wp.y < uEstate.w) {
  float mz = mod(wp.y - uEstate.y, 64.0);
  float mx = mod(wp.x - uEstate.x, 210.0);
  float street = 1.0 - smoothstep(3.0, 4.2, min(mz, 64.0 - mz));
  float cross = 1.0 - smoothstep(3.0, 4.2, min(mx, 210.0 - mx));
  albedo = mix(albedo, vec3(0.2, 0.21, 0.22) * (0.9 + 0.2 * n3), max(street, cross));
}

// industrial yards: tarmac patches and painted bays
if (cls == 6) {
  float tarPatch = smoothstep(0.45, 0.6, wwFbm(wp * 0.02 + 4.0));
  albedo = mix(albedo, vec3(0.16, 0.17, 0.18), tarPatch * 0.8);
}

// roads and the access track
float rd = 99.0; float rAlong = 0.0;
for (int i = 1; i < ${MAX_PTS}; i++) {
  if (i >= uRoadN) break;
  float al; float d = wwSegDist(wp, uRoad[i - 1], uRoad[i], al);
  if (d < rd) { rd = d; rAlong = al + float(i) * 1000.0; }
}
float verge = 1.0 - smoothstep(5.4, 7.4, rd);
float tarmac = 1.0 - smoothstep(4.4, 4.9, rd);
vec3 tar = vec3(0.105, 0.11, 0.115) * (0.85 + 0.3 * wwNoise(wp * 0.7));
albedo = mix(albedo, vec3(0.28, 0.28, 0.27), verge * 0.9);
albedo = mix(albedo, tar, tarmac);
float edgeLine = (1.0 - smoothstep(0.08, 0.16, abs(rd - 4.0))) * fadeFine;
float dashes = step(0.5, fract(rAlong / 9.0)) * (1.0 - smoothstep(0.09, 0.17, rd)) * fadeFine;
albedo = mix(albedo, vec3(0.62), (edgeLine + dashes) * 0.8);

float td = 99.0;
for (int i = 1; i < ${MAX_PTS}; i++) {
  if (i >= uTrackN) break;
  float al; td = min(td, wwSegDist(wp, uTrack[i - 1], uTrack[i], al));
}
albedo = mix(albedo, vec3(0.34, 0.3, 0.24) * (0.85 + 0.3 * n3), (1.0 - smoothstep(2.0, 3.0, td)) * 0.95);

// the turbine pad: compacted gravel round the base
float pad = 1.0 - smoothstep(27.0, 40.0, length(wp));
albedo = mix(albedo, vec3(0.3, 0.285, 0.26) * (0.8 + 0.4 * n3 + 0.2 * n4), pad);

// mud flats seaward of the sea wall (the wall's foot is ~25 m inland of the shoreline)
float shoreD = wp.x - wwShoreX(wp.y);
float mud = 1.0 - smoothstep(14.0, 30.0, shoreD);
float wetMud = 1.0 - smoothstep(-2.0, 10.0, shoreD);
vec3 mudCol = mix(vec3(0.43, 0.38, 0.31), vec3(0.2, 0.18, 0.15), wetMud) * (0.8 + 0.4 * n2);
albedo = mix(albedo, mudCol, mud);

// weather and moving cloud shadows
albedo *= 1.0 - 0.28 * uWet;
float cs = smoothstep(0.5, 0.68, wwFbm((wp + uWind * uTime) * 0.0011));
albedo *= 1.0 - 0.5 * cs * uCloudShadow;

diffuseColor.rgb = albedo;
`;

export function buildTerrain() {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 });
  const landCover = buildLandCoverTexture();

  const road = ROAD.map(([x, z]) => new THREE.Vector2(x, z));
  const track = TRACK.map(([x, z]) => new THREE.Vector2(x, z));
  while (road.length < MAX_PTS) road.push(road[road.length - 1].clone());
  while (track.length < MAX_PTS) track.push(track[track.length - 1].clone());

  const uniforms = {
    uLandCover: { value: landCover },
    uExtent: { value: EXTENT },
    uMapSize: { value: MAP },
    uTime: { value: 0 },
    uWind: { value: new THREE.Vector2(1, 0.4) },
    uCloudShadow: { value: 0.3 },
    uWet: { value: 0 },
    uColA: { value: CLASS_COLORS.map((c) => C(c[0])) },
    uColB: { value: CLASS_COLORS.map((c) => C(c[1])) },
    uRoad: { value: road },
    uRoadN: { value: ROAD.length },
    uTrack: { value: track },
    uTrackN: { value: TRACK.length },
    uEstate: { value: new THREE.Vector4(ZONES.estate.x0, ZONES.estate.z0, ZONES.estate.x1, ZONES.estate.z1) },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorld;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAGMENT_COMMON}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${FRAGMENT_ALBEDO}`);
  };
  material.customProgramCacheKey = () => "ww-terrain";

  const mesh = new THREE.Mesh(buildTerrainGeometry(), material);
  mesh.name = "Terrain";
  mesh.receiveShadow = true;
  mesh.userData.world = true;
  mesh.userData.hotspot = "terrain"; // which thing it is depends on where you tap (hotspots.js)
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
