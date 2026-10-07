// The real place in real time: where the sun is over Bristol right now, and what the sky,
// light, fog and clouds look like for that sun and the current weather.
// Pure functions (no WebGL) so they can be tested and reused.

import * as THREE from "three";

export const SITE = { lat: 51.52, lon: -2.69 };

const RAD = Math.PI / 180;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

/**
 * Where the sun is (low-precision solar position, good to ~0.1°).
 * @returns {{ azimuth: number, elevation: number }} radians; azimuth clockwise from north
 */
export function sunPosition(date, lat = SITE.lat, lon = SITE.lon) {
  const days = date.getTime() / 86400000 + 2440587.5 - 2451545.0; // days since J2000
  const meanLon = (280.46 + 0.9856474 * days) % 360;
  const anomaly = ((357.528 + 0.9856003 * days) % 360) * RAD;
  const eclLon = (meanLon + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RAD;
  const obliquity = (23.439 - 0.0000004 * days) * RAD;
  const ra = Math.atan2(Math.cos(obliquity) * Math.sin(eclLon), Math.cos(eclLon));
  const dec = Math.asin(Math.sin(obliquity) * Math.sin(eclLon));
  const gmstHours = (18.697374558 + 24.06570982441908 * days) % 24;
  const hourAngle = (((gmstHours * 15 + lon) % 360) * RAD) - ra;
  const phi = lat * RAD;
  const elevation = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle));
  // Meeus: azimuth measured from south, westward; add π to measure from north, clockwise.
  const fromSouth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { azimuth: (fromSouth + Math.PI + 2 * Math.PI) % (2 * Math.PI), elevation };
}

/** Unit vector toward the sun in scene space (x east, y up, z south — so north is -z). */
export function sunDirection({ azimuth, elevation }, out = new THREE.Vector3()) {
  const c = Math.cos(elevation);
  return out.set(Math.sin(azimuth) * c, Math.sin(elevation), -Math.cos(azimuth) * c);
}

const C = (hex) => new THREE.Color(hex);
const COLORS = {
  zenithDay: C(0x3b82d8),
  horizonDay: C(0xb4d6f2),
  zenithTwilight: C(0x30497e),
  horizonGolden: C(0xf3a36e),
  zenithNight: C(0x050a18),
  horizonNight: C(0x101b33),
  zenithGrey: C(0x8794a1),
  horizonGrey: C(0xc9d0d6),
  sunLow: C(0xffa25c),
  sunHigh: C(0xfff3de),
  moon: C(0x8fb0ff),
  cloudLight: C(0xffffff),
  cloudShade: C(0xaab4bf),
  cloudGoldenLight: C(0xffd7b0),
  cloudStorm: C(0x5d6772),
};

/**
 * Everything the renderer needs for a moment in time.
 * @param {{ elevation: number, cloud?: number, rain?: number, fog?: number, windMs?: number }} p
 */
export function skyState({ elevation, cloud = 0.3, rain = 0, fog = 0, windMs = 4 }) {
  const e = elevation / RAD; // degrees
  const day = smooth(-6, 10, e);
  const golden = smooth(-7, 0, e) * (1 - smooth(5, 16, e));
  const grey = Math.min(1, cloud * 0.8 + rain * 0.5);
  const murk = Math.max(fog, rain * 0.55, cloud * 0.15);

  const zenith = COLORS.zenithNight.clone().lerp(COLORS.zenithDay, day).lerp(COLORS.zenithTwilight, golden * 0.55);
  const horizon = COLORS.horizonNight.clone().lerp(COLORS.horizonDay, day).lerp(COLORS.horizonGolden, golden * 0.9);
  const greyLight = Math.max(0.08, day);
  zenith.lerp(COLORS.zenithGrey.clone().multiplyScalar(greyLight), grey * 0.85);
  horizon.lerp(COLORS.horizonGrey.clone().multiplyScalar(greyLight), grey * 0.8);

  const sunColor = COLORS.sunLow.clone().lerp(COLORS.sunHigh, smooth(0, 28, e));
  const sunUp = smooth(-2, 12, e);
  const sunStrength = sunUp * (1 - grey * 0.8);

  const cloudLight = COLORS.cloudShade.clone().lerp(COLORS.cloudLight, day).lerp(COLORS.cloudGoldenLight, golden * 0.6);
  const cloudDark = COLORS.cloudShade.clone().multiplyScalar(Math.max(0.12, day)).lerp(COLORS.cloudStorm.clone().multiplyScalar(Math.max(0.15, day)), Math.min(1, rain + cloud * 0.35));

  return {
    elevationDeg: e,
    day,
    night: 1 - smooth(-12, -3, e) * 0 - smooth(-12, -2, e), // 1 deep in the night, 0 by dusk
    golden,
    zenith,
    horizon,
    sunColor,
    sunStrength,
    cloudCover: cloud,
    cloudLight,
    cloudDark,
    // Lighting: sun when it is up, a faint moon otherwise.
    lightColor: sunUp > 0.02 ? sunColor : COLORS.moon,
    lightIntensity: sunUp > 0.02 ? 3.2 * sunUp * (1 - grey * 0.72) + 0.05 : 0.45 * (1 - smooth(-2, 8, e)) * (1 - cloud * 0.6),
    hemiSky: zenith.clone().lerp(horizon, 0.5).lerp(new THREE.Color(0xffffff), 0.25 * day),
    hemiGround: new THREE.Color(0x4a5a3a).multiplyScalar(0.25 + 0.75 * day),
    hemiIntensity: mix(0.28, 1.0, day) * (1 + grey * 0.25),
    fogColor: horizon.clone().lerp(new THREE.Color(0xffffff), grey * 0.1),
    fogNear: mix(520, 40, murk),
    fogFar: mix(3600, 520, murk),
    cloudDrift: 0.004 + windMs * 0.0016,
  };
}
