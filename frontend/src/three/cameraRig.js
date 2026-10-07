// Named camera shots and smooth fly-throughs between them. Shots are defined in the
// nacelle's frame, so the camera always frames the rotor no matter where the wind
// points the turbine. Includes a gentle idle sway and optional pointer parallax.

import * as THREE from "three";
import gsap from "gsap";

const v = (x, y, z) => new THREE.Vector3(x, y, z);

export const SHOTS = {
  overview: { pos: v(120, 78, 175), target: v(0, 56, 0) },
  hero: { pos: v(70, 18, 118), target: v(0, 62, 0) },
  low: { pos: v(26, 4, 46), target: v(0, 40, 0) },
  base: { pos: v(9, 5, 17), target: v(0, 9, 0) },
  towerInside: { pos: v(0.2, 2.4, 0.9), target: v(0, 70, -0.4) },
  tower: { pos: v(14, 52, 34), target: v(0, 50, 0) },
  nacelle: { pos: v(14, 99, 26), target: v(0, 92, 0) },
  machineRoom: { pos: v(-6.6, 94.0, 1.4), target: v(2.6, 91.8, 0) },
  hub: { pos: v(22, 93, 14), target: v(4.6, 92, 0) },
  blades: { pos: v(70, 100, 40), target: v(4.6, 80, 0) },
  face: { pos: v(-2, 93, 22), target: v(-2, 92, 0) },
};

export class CameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {() => number} getYaw  current nacelle yaw (radians)
   */
  constructor(camera, getYaw) {
    this.camera = camera;
    this.getYaw = getYaw;
    this.pos = SHOTS.overview.pos.clone();
    this.target = SHOTS.overview.target.clone();
    this.current = "overview";
    this.swayAmount = 1;
    this.parallax = new THREE.Vector2();
    this.pointer = new THREE.Vector2();
    this.time = 0;
    this._tween = null;
    this._world = new THREE.Vector3();
    this._worldTarget = new THREE.Vector3();
  }

  jumpTo(name) {
    const shot = SHOTS[name];
    if (!shot) return;
    this._tween?.kill();
    this.pos.copy(shot.pos);
    this.target.copy(shot.target);
    this.current = name;
  }

  /** Fly along a curved path (lifted and pushed outward mid-way) to a named shot. */
  flyTo(name, { duration = 3.2, ease = "power2.inOut" } = {}) {
    const shot = SHOTS[name];
    if (!shot) return Promise.resolve();
    this._tween?.kill();
    const from = this.pos.clone();
    const fromTarget = this.target.clone();
    const mid = from.clone().lerp(shot.pos, 0.5);
    const outward = new THREE.Vector3(mid.x, 0, mid.z);
    const lift = Math.min(40, from.distanceTo(shot.pos) * 0.18);
    if (outward.lengthSq() > 0) mid.add(outward.normalize().multiplyScalar(lift));
    mid.y += lift * 0.5;
    const curve = new THREE.CatmullRomCurve3([from, mid, shot.pos.clone()], false, "centripetal");
    const state = { t: 0 };
    this.current = name;
    return new Promise((resolve) => {
      this._tween = gsap.to(state, {
        t: 1,
        duration,
        ease,
        onUpdate: () => {
          curve.getPoint(state.t, this.pos);
          this.target.lerpVectors(fromTarget, shot.target, gsap.parseEase("power1.inOut")(state.t));
        },
        onComplete: resolve,
        onInterrupt: resolve,
      });
    });
  }

  setPointer(x, y) {
    this.pointer.set(x, y);
  }

  update(dt) {
    this.time += dt;
    this.parallax.lerp(this.pointer, 1 - Math.exp(-dt * 2));
    const inside = this.current === "machineRoom" || this.current === "towerInside";
    const sway = inside ? 0.02 : 0.05 * this.swayAmount;
    const yaw = this.getYaw() + Math.sin(this.time * 0.11) * sway + this.parallax.x * 0.04;

    this._world.copy(this.pos).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    this._world.y += Math.sin(this.time * 0.17) * (inside ? 0.05 : 0.8) + this.parallax.y * (inside ? 0.1 : 3);
    this._worldTarget.copy(this.target).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    this.camera.position.copy(this._world);
    this.camera.lookAt(this._worldTarget);
  }
}
