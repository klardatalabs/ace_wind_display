// Small deterministic helpers shared by the world builders. Everything about the landscape
// is generated from fixed seeds, so every screen draws exactly the same place.

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Integer hash -> [0,1). Same function is mirrored in GLSL (see GLSL_NOISE) so JS placement
// of trees and the ground shader's field pattern agree with each other.
export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}

export function fbm(x, y, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

// ---------------------------------------------------------------------------------------
// The shape of the land, in metres. Origin = the turbine; +x east, +z south, so the
// Severn Estuary is to the west (negative x) and the hills rise to the east and south.

/** Where the shore is at a given z (x of the waterline), wandering a little along the coast. */
export function shoreX(z) {
  return -560 + 70 * Math.sin(z / 310) + 34 * Math.sin(z / 97 + 1.3) + 14 * Math.sin(z / 31);
}

/** Ground height at a point: flat reclaimed land near the turbine, a sea wall by the shore,
 *  mudflats and the estuary bed to the west, rolling hills far to the east and south. */
export function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  const sx = shoreX(z);
  const d = x - sx; // >0 inland, <0 towards the water

  // gentle swell across the plain, none right at the turbine
  let h = (fbm(x / 420, z / 420, 3) - 0.5) * 3.2 * smoothstep(120, 600, r);

  // hills well away from the coast
  const hill = smoothstep(900, 3200, r) * smoothstep(-200, 1500, x);
  h += hill * (fbm(x / 1500 + 3.1, z / 1500 - 2.2, 4) * 120 + 10);

  // sea wall: a grassy bank ~4 m high just inland of the shore
  h += 4.2 * Math.exp(-Math.pow((d - 38) / 22, 2));

  // seaward of the wall: mud flats, then the estuary bed
  if (d < 12) {
    const t = smoothstep(12, -150, d);
    h = lerp(h, -0.9 - 5 * smoothstep(-100, -900, d), t);
  }

  return h;
}

/** GLSL twins of hash / noise / fbm, plus a voronoi that returns F1, F2 and the cell id. */
export const GLSL_NOISE = /* glsl */ `
float wwHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 wwHash2(vec2 p){ return vec2(wwHash(p), wwHash(p + 17.31)); }
float wwNoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wwHash(i), wwHash(i + vec2(1.0, 0.0)), f.x), mix(wwHash(i + vec2(0.0, 1.0)), wwHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wwFbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * wwNoise(p); p *= 2.03; a *= 0.5; } return v; }
// where the shore is at a given z (twin of shoreX() above)
float wwShoreX(float z){ return -560.0 + 70.0 * sin(z / 310.0) + 34.0 * sin(z / 97.0 + 1.3) + 14.0 * sin(z / 31.0); }
// x: F1 distance, y: F2 distance, z: random id of the nearest cell
vec3 wwVoronoi(vec2 p){
  vec2 ip = floor(p); vec2 fp = fract(p);
  float f1 = 8.0; float f2 = 8.0; float id = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 r = o + wwHash2(ip + o) * 0.85 + 0.075 - fp;
    float d = length(r);
    if (d < f1) { f2 = f1; f1 = d; id = wwHash(ip + o + 5.7); } else if (d < f2) { f2 = d; }
  }
  return vec3(f1, f2, id);
}
`;
