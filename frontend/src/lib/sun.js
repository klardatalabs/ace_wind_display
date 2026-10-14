// Where the sun is over the turbine at any moment. Pure maths with no 3D dependencies, so
// light pages (the landing page) can use it without loading three.js.

const RAD = Math.PI / 180;

/** Where the turbine stands (also used by the 3D screens via three/environment.js). */
export const SITE = { lat: 51.52, lon: -2.69 };

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

