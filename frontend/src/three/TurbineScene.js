// The hoarding screens' 3D view, in plain Three.js (no React inside).
// Owns the renderer, the turbine, its procedural interior, the landscape / Lawrence Weston
// scan around it, the camera rig and the "Look inside" effect. React talks to it through a
// handful of methods: setTheme, setLive, command, bindLabels, dispose.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import gsap from "gsap";
import { loadTurbine, meshesOf } from "./loadTurbine.js";
import { splitShell } from "./splitShell.js";
import { buildInteriors } from "./interiors.js";
import { LookInside } from "./lookInside.js";
import { CameraRig, SHOTS } from "./cameraRig.js";
import { ENVIRONMENTS, MOSS, roleOf, createMaterial, addOutline, addEdges, isLandscapeRole } from "./themes.js";
import { createSky } from "./sky.js";
import { buildLandscape } from "./landscape.js";
import { markBands, applyBands, blinkAviationLight } from "./accents.js";
import { loadSiteSplat } from "./splat.js";

// The camera shots are composed for the turbine facing this bearing (the prevailing
// south-westerly). The model's yaw is the live nacelle bearing relative to it.
const YAW_REFERENCE_DEG = 215;
const RPM_TO_RAD_PER_SEC = (2 * Math.PI) / 60;
// Where the scan's second turbine stands, so the stand-in landscape puts one there too.
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
   * @param {boolean} [options.useSplat]     stream the Lawrence Weston scan in the realistic look
   * @param {boolean} [options.interactive]  drag to orbit, pinch / wheel to zoom, double-tap to open
   * @param {number} [options.frameShift]     on wide screens, push the subject this fraction of the width to the right (room for text)
   * @param {(u: number) => void} [options.onLookInside]
   * @param {(info: { splat: boolean }) => void} [options.onReady]
   * @param {(err: Error) => void} [options.onError]
   */
  constructor(canvas, { theme = "realistic", useSplat = true, interactive = true, frameShift = 0, onLookInside, onReady, onError } = {}) {
    this.canvas = canvas;
    this.frameShift = frameShift;
    this.theme = theme;
    this.useSplat = useSplat;
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
    this.landscape = buildLandscape();
    this.scene.add(this.landscape);
    this.grid = new THREE.GridHelper(3000, 150, MOSS[500], MOSS[800]);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.35;
    this.grid.position.y = 0.25;
    this.scene.add(this.grid);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.applyTheme(theme); // landscape materials now; the turbine's once it has loaded
    this.#observeSize();
    if (interactive) this.#bindPointer();
    this.timer = new THREE.Timer();
    this.renderer.setAnimationLoop(() => this.#tick());
  }

  // ---------------------------------------------------------------- setup

  #buildLights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, MOSS[200], 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.position.set(160, 260, 120);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -90, right: 90, top: 130, bottom: -40, near: 10, far: 700 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.sun.target.position.set(0, 40, 0);
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

      this.callbacks.onReady?.({ splat: false });
      this.#maybeLoadSplat();
      // Opening move: drift from the wide establishing shot into the hero framing.
      this.rig.flyTo("hero", { duration: 5, ease: "power2.inOut" });
    } catch (err) {
      console.error("[3d] failed to load turbine", err);
      this.callbacks.onError?.(err);
    }
  }

  /** The scan is 14 MB, so it is only fetched once the realistic look is actually shown. */
  #maybeLoadSplat() {
    if (!this.useSplat || this.splat || this.splatLoading || this.theme !== "realistic" || !this.nodes) return;
    this.splatLoading = true;
    this.#loadSplat();
  }

  async #loadSplat() {
    try {
      const { splat } = await loadSiteSplat(this.renderer, this.scene);
      if (this.disposed) return;
      this.splat = splat;
      this.#updateBackdrop();
      this.callbacks.onReady?.({ splat: true });
    } catch (err) {
      console.warn("[3d] scan unavailable, keeping the stand-in landscape", err);
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

  applyTheme(theme) {
    this.theme = theme;
    const env = ENVIRONMENTS[theme];
    this.sky.userData.setColors(env.skyTop, env.skyBottom);
    this.scene.fog = new THREE.Fog(env.fog, env.fogNear, env.fogFar);
    this.renderer.toneMappingExposure = env.exposure;
    this.scene.environment = theme === "realistic" ? this.envMap : null;
    this.grid.visible = theme === "blueprint";

    const lit = theme !== "blueprint";
    this.hemi.intensity = theme === "cartoon" ? 1.5 : theme === "realistic" ? 0.9 : 1;
    this.sun.intensity = theme === "cartoon" ? 1.6 : theme === "realistic" ? 2.6 : 0;
    this.sun.castShadow = lit;

    const roots = [this.nodes?.root, this.neighbour, this.landscape].filter(Boolean);
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
      const role = roleOf(mesh);
      const landscapeRole = isLandscapeRole(role);
      mesh.material?.dispose?.();
      mesh.material = createMaterial(theme, role);
      if (theme === "realistic" && mesh.material.isMeshStandardMaterial) mesh.material.envMapIntensity = 0.55;
      applyBands(mesh, theme);
      if (!landscapeRole) mesh.castShadow = lit && !mesh.userData.neighbour;

      const plain = !mesh.isInstancedMesh && !landscapeRole && !mesh.userData.part;
      if (theme === "cartoon" && plain) addOutline(mesh, mesh.userData.neighbour ? 0.002 : 0.0035);
      if (theme === "blueprint" && plain) addEdges(mesh);
    }

    this.lookInside?.rebind();
    this.#updateBackdrop();
    this.#maybeLoadSplat();
  }

  setTheme(theme) {
    if (theme !== this.theme && ENVIRONMENTS[theme]) this.applyTheme(theme);
  }

  #updateBackdrop() {
    // The scan replaces the stand-in landscape and neighbour turbine in the realistic look.
    const scan = Boolean(this.splat) && this.theme === "realistic";
    if (this.splat) this.splat.visible = scan;
    this.landscape.visible = !scan;
    if (this.neighbour) this.neighbour.visible = !scan;
    if (scan) this.scene.fog.far = 6000;
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
    this.splat?.dispose?.();
    this.envMap?.dispose();
    this.renderer.dispose();
  }
}
