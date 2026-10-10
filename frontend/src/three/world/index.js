// The place around the turbine, assembled: terrain, estuary, woods, the estate, industry,
// solar farm, pylons and the far hills. `update()` pushes the current sky, sun, weather and
// wind into all of it each time they change.

import * as THREE from "three";
import { terrainHeight } from "./noise.js";
import { buildTerrain } from "./terrain.js";
import { buildWater } from "./water.js";
import { buildTrees } from "./trees.js";
import { buildEstate, buildIndustrial, buildSolarFarm, buildPylons } from "./buildings.js";
import { buildHorizon } from "./horizon.js";

export { terrainHeight };

export function buildWorld() {
  const group = new THREE.Group();
  group.name = "World";

  const terrain = buildTerrain();
  const water = buildWater();
  const trees = buildTrees(terrainHeight);
  const estate = buildEstate();
  const industrial = buildIndustrial();
  const solar = buildSolarFarm();
  const pylons = buildPylons();
  const horizon = buildHorizon();

  group.add(horizon.group, terrain.mesh, water.mesh, trees.group, estate.group, industrial.group, solar.group, pylons.group);
  group.userData.world = true;

  /**
   * @param {object} p
   * @param {number} p.time   seconds
   * @param {object} p.sky    environment.skyState() result
   * @param {THREE.Vector3} p.sunDir
   * @param {number} p.windMs
   * @param {THREE.Vector2} p.windVec  unit vector the air is moving towards (x east, y south)
   * @param {number} p.rain   0..1
   * @param {number} p.litFraction  share of homes with lights on
   */
  const update = ({ time, sky, sunDir, windMs, windVec, rain, litFraction }) => {
    terrain.uniforms.uTime.value = time;
    terrain.uniforms.uWind.value.copy(windVec).multiplyScalar(2 + windMs * 1.5);
    terrain.uniforms.uCloudShadow.value = Math.min(1, sky.cloudCover * 1.2) * (0.25 + 0.75 * sky.day);
    terrain.uniforms.uWet.value = rain;

    water.uniforms.uTime.value = time;
    water.uniforms.uSunDir.value.copy(sunDir);
    water.uniforms.uSunColor.value.copy(sky.sunColor);
    water.uniforms.uSunStrength.value = sky.sunStrength;
    water.uniforms.uZenith.value.copy(sky.zenith);
    water.uniforms.uHorizon.value.copy(sky.horizon);
    water.uniforms.uCloud.value = sky.cloudCover;
    water.uniforms.uRough.value = Math.min(1, windMs / 14);
    water.uniforms.uDay.value = sky.day;

    trees.uniforms.uTime.value = time;
    trees.uniforms.uSway.value = Math.min(1.4, 0.15 + windMs / 9);

    horizon.update(sky);
    estate.setLights(litFraction, sky.night);
  };

  /** Per-frame animation that doesn't depend on the weather: waves, drifting shadows, swaying trees. */
  const tick = (time) => {
    terrain.uniforms.uTime.value = time;
    water.uniforms.uTime.value = time;
    trees.uniforms.uTime.value = time;
  };

  return { group, update, tick, groundHeight: terrainHeight, stackTop: industrial.stackTop, estate, pylons, stats: { trees: trees.count, houses: estate.houseCount } };
}
