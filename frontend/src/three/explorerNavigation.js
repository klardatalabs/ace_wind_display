import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import gsap from "gsap";
import { resolveHotspot } from "./hotspots.js";
import { EXPLORER_PARTS } from "../content/explorerParts.js";
import { constrainInterior } from "./explorerBounds.js";
import { terrainHeight } from "./world/noise.js";
import { inspectionRoot, inspectionTargets, inspectionFrame, cablePointAtHeight, visibleIntersection, InspectionHighlight, WindingInspection } from "./inspection.js";

const UP = new THREE.Vector3(0, 1, 0);
const OUTSIDE_NODES = {
  blade: "ACE_Blade_1", hub: "ACE_Hub", nacelle: "ACE_NacelleShell", tower: "ACE_Tower",
  door: "ACE_TowerEntrance", foundation: "ACE_Foundation", transformer: "ACE_TransformerStation",
  sensors: "ACE_RoofSensors", light: "ACE_AviationLight", generator: "ACE_GeneratorRotor",
};
const FLOOR = 1.7;

// Separate from the guided story rig: a visitor's view never drifts home.
// OrbitControls owns the outside. Inside, the camera rotates in place and moves
// through the tower / nacelle instead of orbiting through their walls.
export class ExplorerNavigation {
  constructor(owner) {
    this.owner = owner;
    this.canvas = owner.canvas;
    this.camera = owner.camera;
    this.inside = false;
    this.selected = null;
    this.keys = new Set();
    this.held = new Set();
    this.velocity = new THREE.Vector3();
    this.impulse = new THREE.Vector3();
    this.highlight = new InspectionHighlight();
    this.windingInspection = new WindingInspection();
    this.pointers = new Map();
    this.yaw = 0;
    this.pitch = 0;
    this.eye = new THREE.Vector3(0, FLOOR, -.6);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.look = new THREE.Vector3();
    this.moveVector = new THREE.Vector3();
    this.localCamera = new THREE.Vector3();
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .09;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 3200;
    this.controls.maxPolarAngle = Math.PI * .495;
    this.controls.screenSpacePanning = true;
    this.camera.position.set(185, 90, 245);
    this.controls.target.set(0, 70, 0);
    this.controls.update();
    this.outsidePose = null;
    this.oldSides = new Map();
    this.bind();
  }

  cancel() {
    this.tween?.kill();
    this.tween = null;
    if (this.focusFrame) cancelAnimationFrame(this.focusFrame);
    this.focusFrame = null;
  }

  hit(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObject(this.owner.nodes.root, true);
    let fadedHit = null;
    for (const hit of hits) {
      if (!visibleIntersection(hit)) continue;
      if (this.inside) {
        const proxy = hit.object.userData.inspectionProxy;
        const root = proxy?.object ?? inspectionRoot(hit.object);
        // Unlabelled walls and floors still occlude objects behind them.
        if (!root) { if (hit.object.userData.inspectionGhost) continue; return fadedHit; }
        const { id, room } = root.userData.inspection;
        if (room !== this.room || !EXPLORER_PARTS[id]) return fadedHit;
        const selection = { id, object: root, point: hit.point.clone(), instanceId: proxy?.instanceId ?? (root === hit.object ? hit.instanceId : null) };
        if (hit.object.userData.inspectionGhost) {
          // Prefer another visible winding through the transparent rotor, while
          // still allowing visitors to choose other faded equipment directly.
          if (!fadedHit || (id === this.selected && fadedHit.id !== this.selected)) fadedHit = selection;
          continue;
        }
        return selection;
      }
      const id = resolveHotspot(hit);
      if (!EXPLORER_PARTS[id]) continue;
      if (this.inside && EXPLORER_PARTS[id].area.startsWith("Outside")) continue;
      return { id, object: hit.object, point: hit.point.clone(), instanceId: hit.instanceId };
    }
    return fadedHit;
  }

  bind() {
    const down = (event) => {
      if (event.button !== 0) return;
      this.cancel();
      this.canvas.focus({ preventScroll: true });
      this.canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false, hit: this.hit(event) });
      if (this.pointers.size > 1) {
        for (const pointer of this.pointers.values()) pointer.moved = true;
        const [a, b] = [...this.pointers.values()];
        this.pinch = Math.hypot(a.lastX - b.lastX, a.lastY - b.lastY);
      }
    };
    let hoverTime = 0;
    const move = (event) => {
      const pointer = this.pointers.get(event.pointerId);
      if (!pointer) {
        if (event.pointerType === "mouse" && performance.now() - hoverTime > 80) {
          this.canvas.style.cursor = this.hit(event) ? "pointer" : "grab";
          hoverTime = performance.now();
        }
        return;
      }
      if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) pointer.moved = true;
      if (this.inside && this.pointers.size === 1) {
        this.yaw -= (event.clientX - pointer.lastX) / this.canvas.clientWidth * Math.PI * 2;
        this.pitch = THREE.MathUtils.clamp(this.pitch - (event.clientY - pointer.lastY) / this.canvas.clientHeight * Math.PI, -1.48, 1.48);
      }
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      if (this.inside && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const distance = Math.hypot(a.lastX - b.lastX, a.lastY - b.lastY);
        if (this.pinch > 0 && distance > 0) this.step("forward", THREE.MathUtils.clamp(Math.log(distance / this.pinch) * 3, -.2, .2));
        this.pinch = distance;
      }
    };
    const up = (event) => {
      const pointer = this.pointers.get(event.pointerId);
      this.pointers.delete(event.pointerId);
      if (this.pointers.size < 2) this.pinch = 0;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      if (event.type === "pointerup" && pointer && !pointer.moved && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) <= 6) {
        const hit = pointer.hit ?? this.hit(event);
        if (hit) this.select(hit.id, hit);
        else { this.clearSelection(); this.owner.callbacks.onPick?.(null); }
      }
    };
    const keydown = (event) => {
      if (!this.inside || event.target.closest?.("input, textarea, select, [contenteditable=true]") || !["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "ShiftLeft", "ShiftRight", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) return;
      event.preventDefault();
      this.cancel();
      this.keys.add(event.code);
    };
    const keyup = (event) => this.keys.delete(event.code);
    const blur = () => this.stopMovement();
    const wheel = (event) => {
      this.cancel();
      if (this.inside) { event.preventDefault(); this.step(event.deltaY < 0 ? "forward" : "back", .4); }
    };
    this.canvas.tabIndex = 0;
    this.canvas.style.touchAction = "none";
    this.canvas.addEventListener("pointerdown", down);
    this.canvas.addEventListener("pointermove", move);
    this.canvas.addEventListener("pointerup", up);
    this.canvas.addEventListener("pointercancel", up);
    this.canvas.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    this.controls.addEventListener("start", () => this.cancel());
    this.unbind = () => {
      this.canvas.removeEventListener("pointerdown", down);
      this.canvas.removeEventListener("pointermove", move);
      this.canvas.removeEventListener("pointerup", up);
      this.canvas.removeEventListener("pointercancel", up);
      this.canvas.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
    };
  }

  objectsFor(id) {
    if (this.inside) return inspectionTargets(this.owner.nodes.root, id, this.room);
    const out = [];
    this.owner.nodes.root.traverse((object) => {
      if (object.userData.hotspot === id) out.push(object);
    });
    return out;
  }

  select(id, hit = null) {
    if (!EXPLORER_PARTS[id]) return;
    const candidates = this.objectsFor(id).sort((a, b) => {
      const center = (object) => new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).applyAxisAngle(UP, -this.owner.shown.yaw);
      return center(a).distanceToSquared(this.eye) - center(b).distanceToSquared(this.eye);
    });
    const object = hit?.object ?? (this.inside ? candidates[0] : this.owner.nodes.root.getObjectByName(OUTSIDE_NODES[id]) ?? candidates[0]);
    if (!object && id !== "turbine") return;
    const instanceId = hit?.instanceId ?? object?.userData.inspection?.defaultInstance ?? null;
    const selectionKey = `${object?.uuid ?? id}:${instanceId ?? "whole"}`;
    const details = object?.userData.inspection;
    const label = details?.instanceLabel && Number.isInteger(instanceId)
      ? `${details.instanceLabel} ${instanceId + 1}` : details?.label;
    this.owner.callbacks.onPick?.({ id, selectionKey, label });
    this.selected = id;
    this.cancel();
    this.stopMovement();
    if (this.inside && id === "stator" && object.isInstancedMesh && Number.isInteger(instanceId)) {
      this.windingInspection.select(object, instanceId, this.owner.nodes.yaw);
    } else this.windingInspection.clear();
    if (this.inside) this.highlight.select(object, instanceId);
    // The card changes the viewport; fit only after React and ResizeObserver settle.
    this.focusFrame = requestAnimationFrame(() => {
      this.focusFrame = null;
      if (this.inside) this.focusInside(id, object, { ...hit, instanceId });
      else this.focusOutside(id, object);
    });
  }

  focusOutside(id, object) {
    let selected = object;
    if (id === "turbine") selected = this.owner.nodes.root;
    // glTF nodes with several materials have child meshes; frame the whole part.
    if (selected?.parent?.name.startsWith("ACE_") && selected.parent.name !== "ACE_Turbine") selected = selected.parent;
    const box = new THREE.Box3().setFromObject(selected);
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(1, box.getSize(new THREE.Vector3()).length() / 2);
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect);
    const distance = radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2) * 1.18;
    const direction = this.camera.position.clone().sub(center).normalize();
    const destination = center.clone().addScaledVector(direction, distance);
    destination.y = Math.max(terrainHeight(destination.x, destination.z) + 2, destination.y);
    const position = this.camera.position.clone();
    const target = this.controls.target.clone();
    const progress = { t: 0 };
    this.tween = gsap.to(progress, {
      t: 1, duration: this.reduced.matches ? 0 : 1.2, ease: "power3.inOut",
      onUpdate: () => {
        this.camera.position.lerpVectors(position, destination, progress.t);
        this.controls.target.lerpVectors(target, center, progress.t);
        this.controls.update();
      },
    });
  }

  focusInside(id, object, hit) {
    this.owner.nodes.root.updateMatrixWorld(true);
    const frame = inspectionFrame(object, hit?.instanceId);
    const local = frame.center.applyAxisAngle(UP, -this.owner.shown.yaw);
    // Aim at the rotor face above the journal, which is a separate selectable part.
    if (id === "generator") { local.y += .5; local.z += .7; }
    const continuous = object.userData.inspection?.continuous;
    if (continuous) {
      const height = THREE.MathUtils.clamp(hit?.point?.y ?? this.eye.y, 3.2, 88);
      const point = hit?.point ?? (id === "cable" ? cablePointAtHeight(object, height) : null);
      if (point) local.copy(point).applyAxisAngle(UP, -this.owner.shown.yaw);
      local.y = height;
    }
    const start = this.eye.clone();
    const direction = start.clone().sub(local);
    if (id === "platform") direction.set(0, 1, -.35);
    else if (this.room === "nacelle") {
      if (id === "fans") direction.set(1, -.15, local.z < 0 ? .3 : -.3);
      else if (id === "control") direction.set(.15, .3, 1);
      else if (id === "yaw") direction.set(-1, 1.1, .7);
      else if (id === "stator") direction.set(-1, .15, local.z < 0 ? -.5 : .5);
      else direction.set(-1, .15, .5);
    } else direction.y = .15;
    if (direction.lengthSq() < .01) direction.set(0, .1, 1);
    direction.normalize();
    const radius = continuous ? .65 : Math.max(.18, Math.max(frame.size.x, frame.size.y, frame.size.z) / 2);
    const verticalHalf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const horizontalHalf = Math.atan(Math.tan(verticalHalf) * this.camera.aspect);
    const distance = Math.max(.8, radius / Math.sin(Math.min(verticalHalf, horizontalHalf)) * 1.1);
    const destination = local.clone().addScaledVector(direction, distance);
    // A small winding needs an aisle view: the camera must remain behind the rotor.
    if (id === "stator") destination.x = Math.min(destination.x, .9);
    if (id === "generator") { destination.y = 92.8; destination.z = 1.1; }
    if (this.room === "nacelle") destination.y = Math.max(90.7, destination.y);
    else destination.y = Math.min(90.3, destination.y);
    constrainInterior(destination);
    const lookDirection = local.clone().sub(destination).normalize();
    const yaw = Math.atan2(lookDirection.x, lookDirection.z);
    const pitch = Math.asin(THREE.MathUtils.clamp(lookDirection.y, -.99, .99));
    const startYaw = this.yaw;
    const deltaYaw = Math.atan2(Math.sin(yaw - startYaw), Math.cos(yaw - startYaw));
    const startPitch = this.pitch;
    const progress = { t: 0 };
    this.tween = gsap.to(progress, {
      t: 1, duration: this.reduced.matches ? 0 : .9, ease: "power2.inOut",
      onUpdate: () => {
        this.eye.lerpVectors(start, destination, progress.t);
        this.yaw = startYaw + deltaYaw * progress.t;
        this.pitch = THREE.MathUtils.lerp(startPitch, pitch, progress.t);
      },
    });
  }

  setLocation(location) {
    this.cancel();
    this.clearSelection();
    this.stopMovement();
    this.owner.setExplorerInside(location !== "outside");
    if (location === "outside") {
      this.inside = false;
      this.controls.enabled = true;
      this.owner.rig.railInside = false;
      this.owner.walkHatch?.(false);
      for (const [material, side] of this.oldSides) { material.side = side; material.needsUpdate = true; }
      this.oldSides.clear();
      if (this.outsidePose) {
        this.camera.position.copy(this.outsidePose.position);
        this.controls.target.copy(this.outsidePose.target);
      }
      this.controls.update();
    } else {
      if (!this.inside) this.outsidePose = { position: this.camera.position.clone(), target: this.controls.target.clone() };
      this.inside = true;
      this.controls.enabled = false;
      this.owner.rig.railInside = true;
      this.owner.nodes.root.traverse((object) => {
        if (object.isMesh && object.material && !this.oldSides.has(object.material)) {
          this.oldSides.set(object.material, object.material.side);
          object.material.side = THREE.DoubleSide;
          object.material.needsUpdate = true;
        }
      });
      this.eye.set(location === "nacelle" ? -5.8 : 0, location === "nacelle" ? 92.6 : 3.2, location === "nacelle" ? 1.1 : -.65);
      this.yaw = location === "nacelle" ? Math.PI / 2 : Math.PI;
      this.pitch = location === "nacelle" ? -.05 : .35;
      this.owner.walkHatch?.(true, location === "nacelle");
    }
    this.owner.callbacks.onPick?.(null);
    this.reportedRoom = location;
    this.owner.callbacks.onViewChange?.({ location, height: this.eye.y });
    this.canvas.focus({ preventScroll: true });
  }

  get room() { return this.eye.y >= 90.5 ? "nacelle" : "tower"; }

  clearSelection() {
    this.selected = null;
    this.highlight.clear();
    this.windingInspection.clear();
  }

  stopMovement() {
    this.keys.clear();
    this.held.clear();
    this.velocity.set(0, 0, 0);
    this.impulse.set(0, 0, 0);
  }

  hold(direction, active) {
    this.cancel();
    if (active) this.held.add(direction);
    else this.held.delete(direction);
  }

  step(direction, amount = .5) {
    this.cancel();
    const forward = (direction === "forward" ? 1 : direction === "back" ? -1 : 0) * amount;
    const side = (direction === "right" ? 1 : direction === "left" ? -1 : 0) * amount;
    this.impulse.x += (Math.sin(this.yaw) * forward - Math.cos(this.yaw) * side) * 9;
    this.impulse.z += (Math.cos(this.yaw) * forward + Math.sin(this.yaw) * side) * 9;
    this.impulse.y += (direction === "up" ? 1 : direction === "down" ? -1 : 0) * amount * 9;
    this.impulse.clampLength(0, 8);
  }

  overview() {
    if (this.inside) this.setLocation("outside");
    this.selected = null;
    this.owner.callbacks.onPick?.(null);
    this.select("turbine");
    this.owner.callbacks.onPick?.(null);
    this.selected = null;
  }

  zoom(factor) {
    if (this.inside) this.step(factor < 1 ? "forward" : "back", .5);
    else {
      this.cancel();
      this.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);
      this.controls.update();
    }
  }

  update(dt) {
    if (!this.inside) {
      this.controls.update();
      this.camera.position.y = Math.max(terrainHeight(this.camera.position.x, this.camera.position.z) + 1.8, this.camera.position.y);
      return;
    }
    const frameTime = Math.min(dt, .05);
    const desired = this.moveVector.set(0, 0, 0);
    const fast = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    for (const [codes, direction] of [[["KeyW", "ArrowUp"], "forward"], [["KeyS", "ArrowDown"], "back"], [["KeyA", "ArrowLeft"], "left"], [["KeyD", "ArrowRight"], "right"], [["KeyE"], "up"], [["KeyQ"], "down"]]) {
      if (!this.held.has(direction) && !codes.some(code => this.keys.has(code))) continue;
      if (direction === "forward") desired.z += 1;
      if (direction === "back") desired.z -= 1;
      if (direction === "left") desired.x -= 1;
      if (direction === "right") desired.x += 1;
      if (direction === "up") desired.y += 1;
      if (direction === "down") desired.y -= 1;
    }
    if (desired.lengthSq() > 0) desired.normalize();
    desired.multiplyScalar(fast ? 8 : 2.6);
    desired.y *= fast ? 1.5 : 2.5;
    // Camera right is -X when the visitor faces +Z.
    const side = desired.x, forward = desired.z;
    desired.x = Math.sin(this.yaw) * forward - Math.cos(this.yaw) * side;
    desired.z = Math.cos(this.yaw) * forward + Math.sin(this.yaw) * side;
    this.velocity.lerp(desired, 1 - Math.exp(-12 * frameTime));
    const previous = this.localCamera.copy(this.eye);
    this.eye.addScaledVector(this.velocity, frameTime).addScaledVector(this.impulse, frameTime);
    this.impulse.multiplyScalar(Math.exp(-9 * frameTime));
    constrainInterior(this.eye, previous);
    const yaw = this.owner.shown.yaw;
    this.camera.position.copy(this.eye).applyAxisAngle(UP, yaw);
    this.look.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    this.look.applyAxisAngle(UP, yaw).add(this.camera.position);
    this.camera.lookAt(this.look);
    this.owner.walkHatch?.(true, this.eye.y >= 90.5);
    if (this.reportedRoom !== this.room && !this.tween?.isActive()) {
      this.clearSelection();
      this.owner.callbacks.onPick?.(null);
      this.reportedRoom = this.room;
    }
    if (performance.now() - (this.reportedAt ?? 0) > 150) {
      this.reportedAt = performance.now();
      this.owner.callbacks.onViewChange?.({ location: this.eye.y >= 90.5 ? "nacelle" : "tower", height: this.eye.y });
    }
  }

  dispose() {
    this.cancel();
    if (this.focusFrame) cancelAnimationFrame(this.focusFrame);
    this.unbind();
    this.controls.dispose();
    this.stopMovement();
    this.highlight.clear();
    this.windingInspection.clear();
  }
}
