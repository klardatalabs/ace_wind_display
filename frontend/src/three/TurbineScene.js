// The hoarding screens' 3D view, in plain Three.js (no React inside).
// Owns the renderer, the turbine, its procedural interior, the world around it (terrain,
// estuary, woods, estate) lit by the real sun and weather, the camera rig and the "Look inside" effect. React talks to it through a
// handful of methods: setTheme, setLive, command, bindLabels, dispose.

import * as THREE from "three";
import gsap from "gsap";
import { loadTurbine, meshesOf } from "./loadTurbine.js";
import { splitShell } from "./splitShell.js";
import { buildInteriors } from "./interiors.js";
import { LookInside } from "./lookInside.js";
import { CameraRig, SHOTS } from "./cameraRig.js";
import { roleOf, createMaterial, addOutline, addEdges, CAP_COLORS } from "./themes.js";
import { createSky } from "./sky.js";
import { buildWorld } from "./world/index.js";
import { markBands, applyBands, blinkAviationLight } from "./accents.js";
import { sunPosition, sunDirection, skyState } from "./environment.js";
import { londonHourToDate } from "@shared/time.js";

// The camera shots are composed for the turbine facing this bearing (the prevailing
// south-westerly). The model's yaw is the live nacelle bearing relative to it.
const YAW_REFERENCE_DEG = 215;
const RPM_TO_RAD_PER_SEC = (2 * Math.PI) / 60;
// Where the second, smaller turbine nearby stands.
const NEIGHBOUR_POSITION = new THREE.Vector3(-314, 0, -185);

export const SCREEN_ACTIONS = ["look_inside", "tower_inside", "close_inside", "fly_to_nacelle", "fly_to_base", "overview", "hero", "spin_blades"];

/** The angle equivalent to `to` that is closest to `from`. */
function shortestAngle(from, to) {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export class TurbineScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [options]
   * @param {"cartoon"|"realistic"|"blueprint"} [options.theme]
   * @param {boolean} [options.interactive]  drag to orbit, pinch / wheel to zoom, double-tap to open
   * @param {number} [options.frameShift]     on wide screens, push the subject this fraction of the width to the right (room for text)
   * @param {(u: number) => void} [options.onLookInside]
   * @param {() => void} [options.onReady]
   * @param {(err: Error) => void} [options.onError]
   */
  constructor(canvas, { theme = "realistic", interactive = true, frameShift = 0, onLookInside, onReady, onError } = {}) {
    this.canvas = canvas;
    this.frameShift = frameShift;
    this.theme = theme;
    this.callbacks = { onLookInside, onReady, onError };
    this.live = { rpm: 0, yaw: 0 };
    this.shown = { rpm: 0, yaw: 0 }; // eased toward live, so jumps in the data look mechanical
    this.spinBoostRpm = 0;
    this.labels = [];
    this.labelEls = new Map();
    this.commandToken = 0;
    this.disposed = false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 9000);
    this.rig = new CameraRig(this.camera, () => this.shown.yaw);
    this.rig.jumpTo("overview");

    this.#buildLights();
    this.sky = createSky();
    this.scene.add(this.sky);
    this.world = buildWorld();
    this.scene.add(this.world.group);

    // The environment: where the sun is, what the sky and weather are doing. Set from outside.
    this.env = { cloud: 0.45, rain: 0, fog: 0, windMs: 4, windDeg: 230, litFraction: 0.5, hour: null };
    this.timeOverride = null; // a Date to show instead of "now" (time-lapse, demos)
    this.envDirty = true;
    this.envClock = 0;
    this.lastEnvMap = { elevation: 99, cloud: 99, at: -999 };
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(this.sky.geometry, this.sky.material));
    this.envMap = null;

    this.applyTheme(theme);
    this.#observeSize();
    if (interactive) this.#bindPointer();
    this.timer = new THREE.Timer();
    this.renderer.setAnimationLoop(() => this.#tick());
  }

  // ---------------------------------------------------------------- setup

  #buildLights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x4a5a3a, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.position.set(160, 260, 120);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -110, right: 110, top: 150, bottom: -50, near: 20, far: 1400 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.sun.target.position.set(0, 45, 0);
    this.scene.add(this.hemi, this.sun, this.sun.target);
  }

  async init() {
    try {
      const nodes = await loadTurbine();
      if (this.disposed) return;
      this.nodes = nodes;
      const root = nodes.root;
      this.scene.add(root);

      // A second, slightly smaller turbine where the scan has one (cloned before splitting).
      this.neighbour = root.clone(true);
      this.neighbour.name = "NeighbourTurbine";
      this.neighbour.scale.setScalar(0.9);
      this.neighbour.position.copy(NEIGHBOUR_POSITION);
      this.neighbourRotor = this.neighbour.getObjectByName("RotorSpin");
      this.neighbourYaw = this.neighbour.getObjectByName("Yaw");
      this.neighbour.traverse((o) => (o.userData.neighbour = true));
      this.scene.add(this.neighbour);

      // The tower turns with the nacelle so its peel always opens toward the camera.
      this.towerPivot = new THREE.Group();
      this.towerPivot.name = "TowerPivot";
      root.add(this.towerPivot);
      this.towerPivot.add(nodes.tower, nodes.towerBands);

      for (const blade of nodes.blades) markBands(blade, "y", [[0.74, 0.78], [0.86, 1.1]]);
      markBands(nodes.spinner, "x", [[-0.56, -0.44]]);
      for (const blade of ["ACE_Blade_1", "ACE_Blade_2", "ACE_Blade_3"].map((n) => this.neighbour.getObjectByName(n))) {
        markBands(blade, "y", [[0.74, 0.78], [0.86, 1.1]]);
      }

      const shells = [splitShell(nodes.tower), splitShell(nodes.towerBands), splitShell(nodes.nacelleShell)];
      const interiors = buildInteriors(nodes, this.towerPivot);
      this.lift = interiors.lift;
      this.labels = interiors.labels;

      this.aviationLights = meshesOf(root).filter((m) => m.userData.materialName === "M_Aviation_Light");
      this.applyTheme(this.theme);
      root.updateMatrixWorld(true);
      this.lookInside = new LookInside(shells, (u) => this.callbacks.onLookInside?.(u));

      this.callbacks.onReady?.({});
      // Opening move: drift from the wide establishing shot into the hero framing.
      this.rig.flyTo("hero", { duration: 5, ease: "power2.inOut" });
    } catch (err) {
      console.error("[3d] failed to load turbine", err);
      this.callbacks.onError?.(err);
    }
  }

  #observeSize() {
    const resize = () => {
      const el = this.canvas.parentElement || this.canvas;
      const w = Math.max(1, el.clientWidth);
      const h = Math.max(1, el.clientHeight);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      // Portrait hoardings need a wider vertical field of view to fit the tower.
      this.camera.fov = w / h < 0.8 ? 52 : 38;
      // Off-centre framing: the subject sits right of centre, leaving the left for copy.
      const shift = w / h > 1.15 ? this.frameShift : 0;
      if (shift) this.camera.setViewOffset(w, h, -shift * w, 0, w, h);
      else this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
      this.size = { w, h };
    };
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(this.canvas.parentElement || this.canvas);
    resize();
  }

  #bindPointer() {
    const pointers = new Map();
    let pinch = 0;
    let lastTap = 0;
    const el = this.canvas;
    el.style.touchAction = "none";

    const down = (e) => {
      el.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
      const now = performance.now();
      if (now - lastTap < 320) this.command(this.lookInside?.u > 0.5 ? "close_inside" : "look_inside");
      lastTap = now;
    };
    const move = (e) => {
      const rect = el.getBoundingClientRect();
      this.rig.setPointer(((e.clientX - rect.left) / rect.width) * 2 - 1, ((e.clientY - rect.top) / rect.height) * 2 - 1);
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        this.rig.nudge((e.clientX - prev.x) / rect.width, (e.clientY - prev.y) / rect.height);
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) this.rig.nudge(0, 0, d / pinch);
        pinch = d;
      }
    };
    const up = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
    };
    const wheel = (e) => {
      e.preventDefault();
      this.rig.nudge(0, 0, Math.exp(-e.deltaY * 0.0012));
    };
    const leave = () => this.rig.setPointer(0, 0);

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("wheel", wheel, { passive: false });
    this.unbindPointer = () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("wheel", wheel);
    };
  }

  // ---------------------------------------------------------------- theme

  /** Styles the turbine (the world around it is always natural). */
  applyTheme(theme) {
    this.theme = theme;
    const roots = [this.nodes?.root, this.neighbour].filter(Boolean);
    const meshes = [];
    for (const r of roots) r.traverse((o) => o.isMesh && !o.userData.isOutline && !o.userData.isEdges && meshes.push(o));

    for (const mesh of meshes) {
      for (const child of [...mesh.children]) {
        if (child.userData.isOutline || child.userData.isEdges) {
          mesh.remove(child);
          if (child.userData.isEdges) child.geometry.dispose();
          child.material.dispose();
        }
      }
      mesh.material?.dispose?.();
      mesh.material = createMaterial(theme, roleOf(mesh));
      if (mesh.material.isMeshStandardMaterial) mesh.material.envMapIntensity = 0.9;
      applyBands(mesh, theme);
      mesh.castShadow = theme !== "blueprint" && !mesh.userData.neighbour;

      const plain = !mesh.isInstancedMesh && !mesh.userData.part;
      if (theme === "cartoon" && plain) addOutline(mesh, mesh.userData.neighbour ? 0.002 : 0.0035);
      if (theme === "blueprint" && plain) addEdges(mesh);
    }

    this.lookInside?.setTheme(theme);
    this.lookInside?.rebind();
  }

  setTheme(theme) {
    if (theme !== this.theme) this.applyTheme(theme);
  }

  // ---------------------------------------------------------------- the real place in real time

  /**
   * Weather and wind for the sky, light and ground.
   * @param {{ cloud?: number, rain?: number, fog?: number, windMs?: number, windDeg?: number, litFraction?: number }} env
   */
  setEnvironment(env = {}) {
    Object.assign(this.env, Object.fromEntries(Object.entries(env).filter(([, v]) => v != null && !Number.isNaN(v))));
    this.envDirty = true;
  }

  /** Shows a given UK clock hour today (0–24) instead of the real time; null returns to real time. */
  setTimeOfDay(hour) {
    this.timeOverride = hour == null ? null : londonHourToDate(hour);
    this.envDirty = true;
  }

  /** Smoothly sweeps the sun through the day (used by the "a day in the life" chapter). */
  timeLapse(fromHour, toHour, seconds, onDone) {
    this.timeLapseTween?.kill();
    const state = { h: fromHour };
    this.timeLapseTween = gsap.to(state, {
      h: toHour,
      duration: seconds,
      ease: "sine.inOut",
      onUpdate: () => this.setTimeOfDay(state.h),
      onComplete: () => {
        if (toHour == null || onDone) onDone?.();
      },
    });
    return this.timeLapseTween;
  }

  /** The instant being shown: the real "now", or the demo / time-lapse time. */
  get shownDate() {
    return this.timeOverride ?? new Date();
  }

  #applyEnvironment(time) {
    const date = this.shownDate;
    const sun = sunPosition(date);
    const sunDir = sunDirection(sun, this._sunDir || (this._sunDir = new THREE.Vector3()));
    const sky = skyState({ elevation: sun.elevation, cloud: this.env.cloud, rain: this.env.rain, fog: this.env.fog, windMs: this.env.windMs });

    // the air moves toward (windDeg + 180); scene x = east, z = south
    const to = THREE.MathUtils.degToRad(this.env.windDeg + 180);
    const windVec = (this._windVec ||= new THREE.Vector2()).set(Math.sin(to), -Math.cos(to));
    this.sky.userData.apply(sky, sunDir, windVec);

    // sun by day, a faint moon at night; it always comes from above the horizon
    const lightDir = (this._lightDir ||= new THREE.Vector3()).copy(sunDir);
    if (sun.elevation < 0.02) lightDir.set(-sunDir.x, Math.max(0.35, -sunDir.y), -sunDir.z).normalize();
    this.sun.position.copy(this.sun.target.position).addScaledVector(lightDir, 700);
    this.sun.color.copy(sky.lightColor);
    this.sun.intensity = sky.lightIntensity;
    this.hemi.color.copy(sky.hemiSky);
    this.hemi.groundColor.copy(sky.hemiGround);
    this.hemi.intensity = sky.hemiIntensity;

    if (!this.scene.fog) this.scene.fog = new THREE.Fog(0xffffff, 100, 3000);
    this.scene.fog.color.copy(sky.horizon);
    this.scene.fog.near = sky.fogNear;
    this.scene.fog.far = sky.fogFar;
    this.renderer.toneMappingExposure = 0.92 + 0.25 * (1 - sky.day);

    this.world.update({ time, sky, sunDir, windMs: this.env.windMs, windVec, rain: this.env.rain, litFraction: this.env.litFraction });
    this.skyNow = sky;

    // Re-light the reflections on the turbine when the sky has changed enough to matter.
    const last = this.lastEnvMap;
    if (!this.envMap || Math.abs(sky.elevationDeg - last.elevation) > 3 || Math.abs(sky.cloudCover - last.cloud) > 0.15 || time - last.at > 600) {
      this.envMap?.dispose();
      this.envMap = this.pmrem.fromScene(this.envScene, 0.02, 1, 6000).texture;
      this.scene.environment = this.envMap;
      this.scene.environmentIntensity = 0.55 + 0.45 * sky.day;
      this.lastEnvMap = { elevation: sky.elevationDeg, cloud: sky.cloudCover, at: time };
    }
  }

  // ---------------------------------------------------------------- live data

  /** @param {{ rotorRpm?: number, nacelleDeg?: number }} live */
  setLive({ rotorRpm, nacelleDeg } = {}) {
    if (Number.isFinite(rotorRpm)) this.live.rpm = Math.max(0, rotorRpm);
    if (Number.isFinite(nacelleDeg)) this.live.yaw = -THREE.MathUtils.degToRad(nacelleDeg - YAW_REFERENCE_DEG);
  }

  // ---------------------------------------------------------------- story / remote commands

  /** Runs one of SCREEN_ACTIONS. Resolves when its camera move has finished. */
  async command(action) {
    if (!this.lookInside) return;
    const token = ++this.commandToken;
    const still = () => token === this.commandToken && !this.disposed;
    switch (action) {
      case "look_inside": {
        // Camera fly-in: approach the nacelle from wherever we are, then dock inside.
        this.lookInside.open(3.2);
        if (!["nacelle", "machineRoom", "hub", "face"].includes(this.rig.current)) await this.rig.flyTo("nacelle", { duration: 2.6 });
        if (still()) await this.rig.flyTo("machineRoom", { duration: 2.4, ease: "power3.inOut" });
        return;
      }
      case "tower_inside": {
        this.lookInside.open(3);
        if (!["base", "towerInside", "low"].includes(this.rig.current)) await this.rig.flyTo("base", { duration: 2.8 });
        if (still()) await this.rig.flyTo("towerInside", { duration: 2.4 });
        return;
      }
      case "close_inside":
        this.lookInside.close(2.4);
        await this.rig.flyTo("hero", { duration: 3.4 });
        return;
      case "fly_to_nacelle":
        await this.rig.flyTo(this.lookInside.u > 0.5 ? "machineRoom" : "nacelle");
        return;
      case "fly_to_base":
        await this.rig.flyTo(this.lookInside.u > 0.5 ? "towerInside" : "base");
        return;
      case "overview":
      case "hero":
        if (this.lookInside.u > 0.02) this.lookInside.close(2.2);
        await this.rig.flyTo(action, { duration: 3.6 });
        return;
      case "spin_blades":
        // A playful flourish on top of the real speed; it decays back to the live rpm.
        gsap.fromTo(this, { spinBoostRpm: 0 }, { spinBoostRpm: 14, duration: 0.8, ease: "power2.out", yoyo: true, repeat: 1, repeatDelay: 2.2 });
        return;
      default:
        if (action in SHOTS) await this.rig.flyTo(action);
    }
  }

  // ---------------------------------------------------------------- HUD labels

  /** React passes the DOM nodes for each label id; the scene positions them every frame. */
  bindLabels(map) {
    this.labelEls = map;
  }

  getLabels() {
    return this.labels.map(({ id, text, detail }) => ({ id, text, detail }));
  }

  #updateLabels() {
    if (!this.labelEls.size || !this.size) return;
    const u = this.lookInside?.u ?? 0;
    const fade = THREE.MathUtils.smoothstep(u, 0.55, 0.95);
    const v = new THREE.Vector3();
    // Nearest labels first; any label that would land on top of a nearer one is hidden.
    const candidates = [];
    for (const label of this.labels) {
      const el = this.labelEls.get(label.id);
      if (!el) continue;
      label.anchor.getWorldPosition(v);
      const dist = v.distanceTo(this.camera.position);
      v.project(this.camera);
      const visible = fade > 0.01 && v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.9 && dist < 75;
      candidates.push({ el, dist, visible, x: (v.x * 0.5 + 0.5) * this.size.w, y: (-v.y * 0.5 + 0.5) * this.size.h });
    }
    candidates.sort((a, b) => a.dist - b.dist);
    const placed = [];
    const minGap = Math.max(120, this.size.w * 0.09);
    for (const c of candidates) {
      const clear = c.visible && placed.every((p) => Math.abs(p.x - c.x) > minGap * 1.6 || Math.abs(p.y - c.y) > minGap * 0.6);
      c.el.style.opacity = clear ? fade.toFixed(3) : "0";
      c.el.style.visibility = clear ? "visible" : "hidden";
      if (clear) {
        placed.push(c);
        c.el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0)`;
      }
    }
  }

  // ---------------------------------------------------------------- frame

  #tick() {
    this.timer.update();
    // Real elapsed time drives the rotor, so on a slow device it still turns at the true
    // rpm (it just looks choppier); camera motion uses a clamped step to avoid lurches.
    const realDt = Math.min(this.timer.getDelta(), 1);
    const dt = Math.min(realDt, 0.1);
    const t = this.timer.getElapsed();

    // Rotor: eases to the reported rpm (a 115 m rotor has a lot of inertia) and then
    // turns at exactly that speed. Clockwise seen from upwind, like the real machine.
    this.shown.rpm += (this.live.rpm - this.shown.rpm) * (1 - Math.exp(-realDt * 1.5));
    if (Math.abs(this.live.rpm - this.shown.rpm) < 0.01) this.shown.rpm = this.live.rpm;
    // Yaw drives turn the nacelle slowly, and always the short way round past north.
    const yawGoal = shortestAngle(this.shown.yaw, this.live.yaw);
    this.shown.yaw += (yawGoal - this.shown.yaw) * (1 - Math.exp(-realDt * 0.5));

    if (this.nodes) {
      const omega = (this.shown.rpm + this.spinBoostRpm) * RPM_TO_RAD_PER_SEC;
      this.nodes.rotorSpin.rotation.x -= omega * realDt;
      this.nodes.yaw.rotation.y = this.shown.yaw;
      this.towerPivot.rotation.y = this.shown.yaw;
      if (this.neighbour?.visible) {
        this.neighbourRotor.rotation.x -= omega * 0.94 * realDt;
        this.neighbourYaw.rotation.y = this.shown.yaw;
      }
      if (this.lift && this.lookInside) {
        // The service lift climbs the tower while the cutaway is open.
        const k = (Math.sin(t * 0.07) * 0.5 + 0.5) * this.lookInside.u;
        this.lift.position.y = 3 + k * 82;
      }
      blinkAviationLight(this.aviationLights, t, this.theme);
      this.lookInside?.updatePlanes();
    }

    this.envClock += dt;
    if (this.envDirty || this.timeOverride || this.envClock > 0.5) {
      this.#applyEnvironment(t);
      this.envDirty = false;
      this.envClock = 0;
    }
    this.sky.userData.uniforms.uTime.value = t;
    this.world.tick(t);

    this.rig.update(dt);
    this.sky.position.copy(this.camera.position);
    this.#updateLabels();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver?.disconnect();
    this.unbindPointer?.();
    gsap.killTweensOf(this);
    if (this.lookInside) gsap.killTweensOf(this.lookInside);
    this.rig._tween?.kill();
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => m.dispose?.());
    });
    this.pmrem?.dispose();
    this.envMap?.dispose();
    this.renderer.dispose();
  }
}
