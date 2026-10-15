import * as THREE from "three";
import { towerRadiusAt } from "./interiors.js";

export function constrainInterior(position, previous = null) {
  position.y = THREE.MathUtils.clamp(position.y, 1.7, 93.3);
  // Cross between rooms through the open central hatch, rather than snapping
  // sideways into the tower when descending through the machine-room floor.
  if (previous && (previous.y >= 90.5) !== (position.y >= 90.5) && Math.hypot(position.x, position.z) > .8) {
    position.y = previous.y >= 90.5 ? 90.501 : 90.499;
  }
  if (position.y < 90.5) {
    const radius = Math.max(.45, towerRadiusAt(position.y) - .4);
    const distance = Math.hypot(position.x, position.z);
    if (distance > radius) { position.x *= radius / distance; position.z *= radius / distance; }
  } else {
    position.x = THREE.MathUtils.clamp(position.x, -5.8, 1.15);
    const width = THREE.MathUtils.mapLinear(THREE.MathUtils.clamp(position.x, -1.5, .25), -1.5, .25, 1.25, 2.15);
    position.z = THREE.MathUtils.clamp(position.z, -width, width);
  }
  return position;
}
