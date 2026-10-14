import * as THREE from "three";
import { towerRadiusAt } from "./interiors.js";

export function constrainInterior(position) {
  position.y = THREE.MathUtils.clamp(position.y, 1.7, 93.3);
  if (position.y < 90.5) {
    const radius = Math.max(.45, towerRadiusAt(position.y) - .4);
    const distance = Math.hypot(position.x, position.z);
    if (distance > radius) { position.x *= radius / distance; position.z *= radius / distance; }
  } else {
    position.x = THREE.MathUtils.clamp(position.x, -5.8, 1.15);
    position.z = THREE.MathUtils.clamp(position.z, -1.25, 1.25);
  }
  return position;
}
