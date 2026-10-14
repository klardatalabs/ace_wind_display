// Named camera shots and smooth fly-throughs between them. Shots are defined in the
// nacelle's frame, so the camera always frames the rotor no matter where the wind
// points the turbine. Includes a gentle idle sway, pointer parallax, and drag-to-orbit /
// pinch-to-zoom that eases back to the story's shot after a few idle seconds.

import * as THREE from "three";
import gsap from "gsap";
import { walkAt } from "./walk.js";

const v = (x, y, z) => new THREE.Vector3(x, y, z);

export const SHOTS = {
  overview: { pos: v(320, 130, 450), target: v(0, 62, 0) },
  hero: { pos: v(175, 42, 255), target: v(0, 72, 0) },
  low: { pos: v(48, 3, 78), target: v(0, 66, 0) },
  // High over the estate side: the turbine with Lawrence Weston spread out behind it.
  aerial: { pos: v(-330, 170, 380), target: v(0, 50, -40) },
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
    this.user = { yaw: 0, pitch: 0, zoom: 1 }; // eased toward userTarget
    this.userTarget = { yaw: 0, pitch: 0, zoom: 1 };
    this.lastInteraction = -Infinity;
    this.returnAfter = 7; // seconds of no touching before the camera drifts home
    this.walk = null; // { s, lookYaw, lookPitch } while walking through the turbine
    this.rail = false;
    this.railInside = false;
    this._eye = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._tween = null;
    this._world = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    this._worldTarget = new THREE.Vector3();
  }

  jumpTo(name) {
    const shot = SHOTS[name];
    if (!shot) return;
    this._tween?.kill();
    this.resetUser();
    this.pos.copy(shot.pos);
    this.target.copy(shot.target);
    this.current = name;
  }

  /** Fly along a curved path (lifted and pushed outward mid-way) to a named shot. */
  flyTo(name, { duration = 3.2, ease = "power2.inOut" } = {}) {
    const shot = SHOTS[name];
    if (!shot) return Promise.resolve();
    this._tween?.kill();
    this.resetUser();
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

  get isInside() {
    return this.railInside || Boolean(this.walk) || this.current === "machineRoom" || this.current === "towerInside";
  }

  /** The story rail supplies world coordinates; it must not inherit turbine yaw. */
  setRailPose(position, target, inside = false) {
    this.rail = true;
    this.railInside = inside;
    this.current = "rail";
    this.pos.copy(position);
    this.target.copy(target);
  }

  /** Begin (or resume) the first-person walk at progress s. */
  startWalk(s = 0) {
    this._tween?.kill();
    this.resetUser();
    this.walk = this.walk ?? { s, lookYaw: 0, lookPitch: 0 };
    this.walk.s = s;
    this.current = "walk";
  }

  setWalk(s) {
    if (this.walk) this.walk.s = Math.min(1, Math.max(0, s));
  }

  /** Look around while walking: dx, dy are drag deltas as fractions of the screen. */
  lookAround(dx, dy) {
    if (!this.walk) return;
    this.walk.lookYaw = THREE.MathUtils.clamp(this.walk.lookYaw - dx * 3.4, -2.6, 2.6);
    this.walk.lookPitch = THREE.MathUtils.clamp(this.walk.lookPitch - dy * 2.2, -1.1, 1.1);
    this.lastInteraction = this.time;
  }

  endWalk(next = "hero") {
    if (!this.walk) return;
    // leave from where the camera is, so there is no jump
    this.pos.copy(this._eye);
    this.target.copy(this._look);
    this.walk = null;
    this.current = "walkExit";
    return this.flyTo(next, { duration: 3.2 });
  }

  /** Drag deltas in screen fractions (dx, dy) and/or a zoom factor (>1 = closer). */
  nudge(dx = 0, dy = 0, zoomBy = 1) {
    const t = this.userTarget;
    t.yaw -= dx * Math.PI * 1.2;
    t.pitch = THREE.MathUtils.clamp(t.pitch + dy * 1.4, -0.6, 0.9);
    t.zoom = THREE.MathUtils.clamp(t.zoom * zoomBy, this.isInside ? 0.8 : 0.45, this.isInside ? 1.4 : 2.4);
    this.lastInteraction = this.time;
  }

  resetUser() {
    Object.assign(this.userTarget, { yaw: 0, pitch: 0, zoom: 1 });
  }

  update(dt) {
    this.time += dt;
    this.parallax.lerp(this.pointer, 1 - Math.exp(-dt * 2));
    if (this.time - this.lastInteraction > this.returnAfter) this.resetUser();
    const k = 1 - Math.exp(-dt * 4);
    for (const key of ["yaw", "pitch", "zoom"]) this.user[key] += (this.userTarget[key] - this.user[key]) * k;

    const inside = this.isInside;
    if (this.rail) {
      this._offset.copy(this.pos).sub(this.target);
      this._offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.user.yaw);
      this._offset.y += this.user.pitch * Math.max(this._offset.length(), 2);
      this._offset.multiplyScalar(1 / this.user.zoom);
      this.camera.position.copy(this.target).add(this._offset);
      this.camera.lookAt(this.target);
      return;
    }
    const sway = inside ? 0.01 : 0.02 * this.swayAmount;
    // The camera keeps the turbine facing it by following the nacelle, but the live wind
    // direction is noisy: shifts under ~10° are ignored and bigger ones are followed slowly,
    // so the whole view never swings back and forth with the data.
    const nacelle = this.getYaw();
    if (this.viewYaw === undefined) this.viewYaw = nacelle;
    const off = Math.atan2(Math.sin(nacelle - this.viewYaw), Math.cos(nacelle - this.viewYaw));
    if (Math.abs(off) > 0.17) this.viewYaw += off * Math.min(1, dt * 0.12);
    // Walking keeps the eye on the clear aisle; drag changes the look direction.
    const yaw = this.viewYaw + (this.walk ? 0 : Math.sin(this.time * 0.11) * sway + this.parallax.x * 0.04);

    if (this.walk) {
      // first person: follow the path, with a slow drift back to centre after looking around
      if (this.time - this.lastInteraction > 5) {
        this.walk.lookYaw *= 1 - Math.min(1, dt * 0.8);
        this.walk.lookPitch *= 1 - Math.min(1, dt * 0.8);
      }
      walkAt(this.walk.s, this._eye, this._look);
      const bob = Math.sin(this.walk.s * 420) * 0.008; // rung by rung, barely felt
      this._eye.y += bob;
      this._look.sub(this._eye);
      this._look.applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.walk.lookYaw);
      const right = this._offset.set(-this._look.z, 0, this._look.x).normalize();
      this._look.applyAxisAngle(right, this.walk.lookPitch);
      this._look.add(this._eye);
      this.pos.copy(this._eye);
      this.target.copy(this._look);
      this._world.copy(this._eye).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
      this._worldTarget.copy(this._look).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
      this.camera.position.copy(this._world);
      this.camera.lookAt(this._worldTarget);
      return;
    }

    // Orbit around the shot's target: yaw around it, tilt up/down, dolly in/out.
    this._offset.copy(this.pos).sub(this.target);
    this._offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.user.yaw);
    const flat = Math.hypot(this._offset.x, this._offset.z);
    this._offset.y += this.user.pitch * Math.max(flat, 2);
    this._offset.multiplyScalar(1 / this.user.zoom);
    this._world.copy(this.target).add(this._offset);
    this._world.y = Math.max(this._world.y, inside ? this._world.y : 1.5);

    this._world.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    this._world.y += Math.sin(this.time * 0.17) * (inside ? 0.03 : 0.3) + this.parallax.y * (inside ? 0.1 : 3);
    this._worldTarget.copy(this.target).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    this.camera.position.copy(this._world);
    this.camera.lookAt(this._worldTarget);
  }
}
