// The X-ray climb's stops (three/xrayClimb.js), as plain data so the captions can share the
// timing without loading three.js. Bottom to top: `shot` is the camera position and target
// in the nacelle's frame; the camera takes `fly` seconds to get there, then holds for
// `hold` seconds, circling `drift` radians round the target; `lit` are the interior hotspots
// (interiors.js userData.hotspot) lit up there; `height` is roughly where the stop is, in
// metres above the ground, for the route gauge.
export const XRAY_STOPS = [
  { id: "ground", shot: { pos: [32, 5, 42], target: [0, -9, 0] }, fly: 3.2, hold: 5.2, lit: ["piles"], drift: 0.22, height: -22 },
  { id: "base", shot: { pos: [8, 4.2, 11], target: [0, 2.2, -0.6] }, fly: 2.8, hold: 5.0, lit: ["cabinet"], drift: 0.18, height: 0 },
  { id: "lower", shot: { pos: [9, 22, 13], target: [0, 25, -0.6] }, fly: 2.8, hold: 5.0, lit: ["ladder", "platform"], drift: 0.16, height: 25 },
  { id: "middle", shot: { pos: [8.5, 50, 12.5], target: [0, 53, -0.4] }, fly: 2.8, hold: 5.0, lit: ["lift", "cable"], drift: 0.16, height: 53 },
  { id: "top", shot: { pos: [9.5, 86.5, 13], target: [0, 89.2, 0] }, fly: 2.8, hold: 5.0, lit: ["yaw"], drift: 0.16, height: 89 },
  { id: "nacelle", shot: { pos: [-3, 99, 17], target: [0.5, 92.4, 0] }, fly: 2.8, hold: 5.4, lit: ["stator", "mainshaft", "fans"], drift: 0.2, height: 92 },
  { id: "hub", shot: { pos: [19, 95.5, 13], target: [5, 92, 0] }, fly: 2.6, hold: 5.0, lit: [], drift: 0.18, height: 92 },
];

/** Seconds from the start of the climb to the end of its last hold. */
export const XRAY_SECONDS = XRAY_STOPS.reduce((t, s) => t + s.fly + s.hold, 0);
