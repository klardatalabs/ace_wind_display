// A first-person walk through the turbine: up to the tower door, in, up the ladder past the
// platforms, through the hatch into the nacelle, and across the machine room to the
// generator. The camera follows this path; progress `s` runs 0 → 1 (so a story can play it,
// a phone slider can scrub it, and a visitor can drag to look around while it moves).

import * as THREE from "three";

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// Eye position and look-at target along the walk, in the turbine's own frame (the camera
// rig turns the whole path with the nacelle). The tower door faces -z; the ladder runs up
// its back wall; the nacelle floor is ~89.5 m up.
const KEYS = [];
const key = (eye, look, caption) => KEYS.push({ eye, look, caption });

key(v(0, 1.7, -15), v(0, 2.6, 0));
key(v(0, 1.7, -7), v(0, 2.4, 0));
key(v(0, 1.7, -3.2), v(0, 2.4, 0.6));
key(v(0, 1.7, -0.9), v(0, 5, -1.55));
for (let y = 4; y <= 85; y += 3) key(v(0.03 * Math.sin(y * 0.4), y, -0.85), v(0, y + 4.5, -1.6));
key(v(0, 87.4, -0.85), v(0, 90.6, -0.85));
key(v(0, 90.9, -0.85), v(-0.6, 91.8, 0.8));
key(v(-0.45, 92.3, 0.5), v(-3.6, 93, 1.75));
key(v(-1.2, 92.6, 1.75), v(-3.6, 93, 1.75));
key(v(-2.8, 92.8, 1.75), v(2.35, 92.2, 0));
key(v(-5.8, 92.9, 1.4), v(2.35, 92.2, 0));
key(v(-6.6, 92.9, 1.2), v(2.35, 92.2, 0));

function buildPath() {
  const eyes = new THREE.CatmullRomCurve3(KEYS.map((k) => k.eye), false, "centripetal");
  const looks = new THREE.CatmullRomCurve3(KEYS.map((k) => k.look), false, "centripetal");
  const cumulative = [0];
  for (let i = 1; i < KEYS.length; i++) cumulative.push(cumulative[i - 1] + KEYS[i].eye.distanceTo(KEYS[i - 1].eye));
  const total = cumulative[cumulative.length - 1];
  return { eyes, looks, cumulative, total };
}

const PATH = buildPath();

/** Length of the walk in metres. */
export const WALK_LENGTH = PATH.total;

/** Where the climb's chapters begin, as progress values, for captions. */
export const WALK_STAGES = [
  { from: 0, to: 0.06, id: "approach" },
  { from: 0.06, to: 0.11, id: "door" },
  { from: 0.11, to: 0.46, id: "lower" },
  { from: 0.46, to: 0.8, id: "upper" },
  { from: 0.8, to: 0.9, id: "hatch" },
  { from: 0.9, to: 1.01, id: "machine" },
];

const _a = new THREE.Vector3();

/** Eye and look-at target at progress s (0..1). */
export function walkAt(s, eye, look) {
  const dist = THREE.MathUtils.clamp(s, 0, 1) * PATH.total;
  let i = 0;
  while (i < PATH.cumulative.length - 2 && PATH.cumulative[i + 1] < dist) i++;
  const span = PATH.cumulative[i + 1] - PATH.cumulative[i] || 1;
  const t = THREE.MathUtils.clamp((dist - PATH.cumulative[i]) / span, 0, 1);
  const u = (i + t) / (KEYS.length - 1);
  PATH.eyes.getPoint(u, eye);
  PATH.looks.getPoint(u, look);
  return { height: eye.y };
}

/** Metres of climb at progress s (for "47 m up" captions). */
export function walkHeight(s) {
  walkAt(s, _a, new THREE.Vector3());
  return _a.y;
}
