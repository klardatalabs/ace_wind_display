// The hoarding screens' 3D view, in plain Three.js (no React inside).
// Owns the renderer, the turbine, its procedural interior, the world around it (terrain,
// estuary, woods, estate) lit by the real sun and weather, the camera rig and the "Look inside" effect. React talks to it through a
// handful of methods: setTheme, setLive, command, bindLabels, dispose.

import * as THREE from "three";
import gsap from "gsap";
import { loadTurbine, meshesOf } from "./loadTurbine.js";
import { splitShell } from "./splitShell.js";
import { buildInteriors, buildWalkHatch } from "./interiors.js";
import { LookInside } from "./lookInside.js";
import { CameraRig, SHOTS } from "./cameraRig.js";
import { roleOf, createMaterial, addOutline, addEdges, CAP_COLORS, XRAY, isDrawnTheme, drawnColours } from "./themes.js";
import { XRAY_STOPS, buildFoundation, xrayAnchors, lightParts, clearLit } from "./xrayClimb.js";
import { createSky } from "./sky.js";
import { buildWorld } from "./world/index.js";
import { loadSiteSplat } from "./splat.js";
import { markBands, applyBands, blinkAviationLight } from "./accents.js";
import { sunPosition, sunDirection, skyState, nightReadability } from "./environment.js";
import { createWeatherFx } from "./fx.js";
import { buildAnnotations } from "./annotations.js";
import { walkHeight } from "./walk.js";
import { StoryRail } from "./storyRail.js";
import { resolveHotspot } from "./hotspots.js";
import { ExplorerNavigation } from "./explorerNavigation.js";
import { londonHourToDate } from "@shared/time.js";

// The X-ray climb's stops fly like any other named shot.
for (const stop of XRAY_STOPS) SHOTS[`xray-${stop.id}`] = stop.shot;

// The camera shots are composed for the turbine facing this bearing (the prevailing
// south-westerly). The model's yaw is the live nacelle bearing relative to it.
const YAW_REFERENCE_DEG = 215;
const NIGHT_SKY_FILL = new THREE.Color(0xb9cbd5);
const NIGHT_GROUND_FILL = new THREE.Color(0x596c57);
const RPM_TO_RAD_PER_SEC = (2 * Math.PI) / 60;
// Where the second, smaller turbine nearby stands.
const NEIGHBOUR_POSITION = new THREE.Vector3(-314, 0, -185);

export const SCREEN_ACTIONS = ["look_inside", "tower_inside", "close_inside", "fly_to_nacelle", "fly_to_base", "overview", "hero", "spin_blades", "walk_start", "walk_stop", "walk_to"];

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
   * @param {boolean} [options.storyRail]     opt into the continuous energy journey
   * @param {boolean} [options.storyTour]     build the energy journey to play as one chapter (the "tour" action)
   * @param {boolean} [options.scan]          fade the real Lawrence Weston scan in around the turbine (realistic look)
   * @param {number} [options.maxFps]         draw at most this many frames a second (unattended screens save GPU)
   * @param {number} [options.maxPixelRatio]  cap on device pixels per CSS pixel
   * @param {(u: number) => void} [options.onLookInside]
   * @param {(pick: { id: string, x: number, y: number } | null) => void} [options.onPick]  something was tapped (id of its description card), or null
   * @param {(s: number, height: number) => void} [options.onWalk]  progress 0..1 and metres climbed during the walk
   * @param {() => void} [options.onReady]
   * @param {(err: Error) => void} [options.onError]
   */
  constructor(canvas, { theme = "realistic", interactive = true, explorer = false, frameShift = 0, storyRail = false, storyTour = false, scan = false, maxFps = 0, maxPixelRatio = 1.75, onLookInside, onWalk, onPick, onViewChange, onReady, onError } = {}) {
    this.canvas = canvas;
    this.frameShift = frameShift;
    this.theme = theme;
    this.storyRailEnabled = storyRail;
    this.storyTourEnabled = storyTour && !storyRail && !explorer;
    this.explorerEnabled = explorer;
    this.scanEnabled = scan && !explorer;
    this.callbacks = { onLookInside, onReady, onError, onWalk, onPick, onViewChange };
    this.live = { rpm: 0, yaw: 0 };
    this.shown = { rpm: 0, yaw: 0 }; // eased toward live, so jumps in the data look mechanical
    this.spinBoostRpm = 0;
    this.labels = [];
    this.labelEls = new Map();
    this.commandToken = 0;
    this.disposed = false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, storyRail ? 1 : maxPixelRatio));
    this.frameInterval = maxFps > 0 ? 1000 / maxFps : 0;
    this.lastFrameAt = -Infinity;
    // Nothing is drawn until every material's GPU program has compiled (see #compileAll):
    // drawing first would compile them one at a time on the main thread, freezing the page
    // for many seconds on integrated graphics.
    this.warming = true;
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
    // The dedicated interior viewer has no synthetic exterior scenery. Its
    // outside view is supplied by the real-world Cesium viewer on the same page.
    this.world = explorer
      ? { group: new THREE.Group(), stackTop: new THREE.Vector3(), tick() {}, update() {} }
      : buildWorld();
    this.scene.add(this.world.group);

    // The environment: where the sun is, what the sky and weather are doing. Set from outside.
    this.env = { cloud: 0.45, rain: 0, fog: 0, windMs: 4, windDeg: 230, litFraction: 0.5, hour: null };
    this.timeOverride = null; // a Date to show instead of "now" (story time-lapse)
    this.serverHour = null; // a demo hour from the server's environment override
    this.envDirty = true;
    this.envClock = 0;
    this.lastEnvMap = { elevation: 99, cloud: 99, at: -999 };
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(this.sky.geometry, this.sky.material));
    this.envMap = null;

    this.fx = createWeatherFx();
    this.scene.add(this.fx.group);
    this.windViz = 0;
    this.interior = { f: 0 }; // 0 = out in the open, 1 = inside the turbine (dims the daylight, switches on the lamps)
    this.headlamp = new THREE.PointLight(0xffe9c8, 0, 18, 2);
    this.camera.add(this.headlamp);
    this.scene.add(this.camera);
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line.threshold = 0.8;
    this.pickTarget = null; // { object, local } or { world } — what the card is about
    this.tagDefs = [];
    this.tagEls = new Map();
    this.anchors = {};

    this.applyTheme(theme);
    this.#observeSize();
    if (interactive && !explorer) this.#bindPointer();
    this.timer = new THREE.Timer();
    this.renderer.setAnimationLoop((now) => this.#tick(now));
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
    this.nightFill = new THREE.DirectionalLight(0xc5d9ee, 0);
    this.nightFill.castShadow = false;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.nightFill, this.nightFill.target);
  }

  async init() {
    try {
      const nodes = await loadTurbine();
      if (this.disposed) return;
      this.nodes = nodes;
      const root = nodes.root;
      this.scene.add(root);

      // A second, slightly smaller turbine where the scan has one (cloned before splitting).
      if (!this.explorerEnabled) {
        this.neighbour = root.clone(true);
        this.neighbour.name = "NeighbourTurbine";
        this.neighbour.scale.setScalar(0.9);
        this.neighbour.position.copy(NEIGHBOUR_POSITION);
        this.neighbourRotor = this.neighbour.getObjectByName("RotorSpin");
        this.neighbourYaw = this.neighbour.getObjectByName("Yaw");
        this.neighbour.traverse((o) => (o.userData.neighbour = true));
        this.scene.add(this.neighbour);
      }

      // The tower turns with the nacelle so its peel always opens toward the camera.
      this.towerPivot = new THREE.Group();
      this.towerPivot.name = "TowerPivot";
      root.add(this.towerPivot);
      this.towerPivot.add(nodes.tower, nodes.towerBands);

      for (const blade of nodes.blades) markBands(blade, "y", [[0.74, 0.78], [0.86, 1.1]]);
      markBands(nodes.spinner, "x", [[-0.56, -0.44]]);
      for (const blade of ["ACE_Blade_1", "ACE_Blade_2", "ACE_Blade_3"].map((n) => this.neighbour?.getObjectByName(n))) {
        if (blade) markBands(blade, "y", [[0.74, 0.78], [0.86, 1.1]]);
      }

      const shells = [splitShell(nodes.tower), splitShell(nodes.towerBands), splitShell(nodes.nacelleShell)];
      const interiors = buildInteriors(nodes, this.towerPivot, { explorer: this.explorerEnabled });
      this.lift = interiors.lift;
      this.labels = interiors.labels;
      this.nacelleLights = interiors.nacelleLights;
      this.walkHatch = buildWalkHatch(nodes);
      this.interiors = interiors;
      // The opening camera is outside. Keep the dense interior out of its draw calls;
      // reveal it as soon as a walk, cutaway or X-ray begins.
      interiors.towerInterior.visible = false;
      interiors.nacelleInterior.visible = false;
      // Piles and pad under the tower, drawn only in the X-ray.
      this.foundation = buildFoundation();
      this.towerPivot.add(this.foundation);

      nodes.yaw.add(this.fx.wind);
      this.annotations = buildAnnotations(this.towerPivot, nodes.yaw);
      const anchor = (parent, name, x, y, z) => {
        const o = new THREE.Object3D();
        o.name = `tag-${name}`;
        o.position.set(x, y, z);
        parent.add(o);
        return o;
      };
      this.anchors = {
        hub: anchor(nodes.yaw, "hub", 8.2, 3, 0),
        rotorTip: anchor(nodes.yaw, "rotorTip", 4.6, 3, 58),
        windward: anchor(nodes.yaw, "windward", 75, 8, 6),
        nacelle: anchor(nodes.yaw, "nacelle", -2, 9, 0),
        base: anchor(root, "base", 0, 4, 0),
        tower: anchor(this.towerPivot, "tower", 0, 46, 0),
        transformer: anchor(root, "transformer", -12, 6, -9),
        estate: anchor(root, "estate", 640, 30, -620),
        stack: anchor(root, "stack", this.world.stackTop.x, this.world.stackTop.y, this.world.stackTop.z),
      };
      for (const [name, obj] of Object.entries(this.annotations.anchors)) this.anchors[`dim${name[0].toUpperCase()}${name.slice(1)}`] = obj;
      Object.assign(this.anchors, xrayAnchors(this.towerPivot, nodes.yaw, interiors.lift));

      this.aviationLights = meshesOf(root).filter((m) => m.userData.materialName === "M_Aviation_Light");
      this.applyTheme(this.theme);
      root.updateMatrixWorld(true);
      this.lookInside = new LookInside(shells, (u) => this.callbacks.onLookInside?.(u));
      if (this.storyRailEnabled) this.story = new StoryRail(this, interiors);
      else if (this.storyTourEnabled) this.tour = new StoryRail(this, interiors, { autoplay: false });

      if (this.explorerEnabled) this.explorer = new ExplorerNavigation(this);
      await this.#compileAll();
      if (this.disposed) return;
      this.callbacks.onReady?.({});
      // Opening move: drift from the wide establishing shot into the hero framing.
      if (!this.story && !this.explorerEnabled) this.rig.flyTo("hero", { duration: 5, ease: "power2.inOut" });
      // The turbine is up; the real surroundings stream in behind it.
      if (this.scanEnabled && this.theme === "realistic") this.#loadScan();
    } catch (err) {
      console.error("[3d] failed to load turbine", err);
      this.warming = false;
      this.callbacks.onError?.(err);
    }
  }

  /** Prepare every shader before the story moves into the turbine. */
  async #compileAll() {
    if (!this.envMap) this.#applyEnvironment(this.timer.getElapsed());
    // compileAsync traverses the hidden interior too. Keep it attached so the
    // first interior chapter cannot trigger a fresh compile in mid-animation.
    let timeout;
    try {
      await Promise.race([
        this.renderer.compileAsync(this.scene, this.camera),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("3D shader preparation timed out")), 20_000); }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
    this.warming = false;
  }

  async #loadScan() {
    try {
      const { splat, spark } = await loadSiteSplat(this.renderer, this.scene);
      if (this.disposed) return splat.dispose?.();
      this.splat = splat;
      this.spark = spark;
      // Fades in from here on; #updateScan decides how much of it to show each frame.
    } catch (err) {
      // No scan is fine: the generated landscape stays.
      console.warn("[3d] the Lawrence Weston scan didn't load", err);
    }
  }

  /**
   * The real scan stays round the turbine on every shot (softer close to the ground, but
   * real), and steps aside only while the turbine is opened up to look inside. Whichever is
   * showing, the generated scenery or the scan, the other steps aside.
   */
  #updateScan(dt) {
    const splat = this.splat;
    if (!splat) return;
    // The energy journey follows the generated route, so the scan steps aside while it plays.
    const want = this.theme === "realistic" && (this.lookInside?.u ?? 0) < 0.2 && !this.tour?.active ? 1 : 0;
    splat.opacity += (want - splat.opacity) * (1 - Math.exp(-dt * 1.6));
    if (Math.abs(want - splat.opacity) < 0.005) splat.opacity = want;
    splat.visible = splat.opacity > 0.01;
    const scan = splat.opacity > 0.6;
    if (scan !== this.scanShown) {
      this.scanShown = scan;
      this.world.setScan?.(scan);
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
      const shift = !this.rig.walk && w / h > 1.15 ? this.frameShift : 0;
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
    const taps = new Map();
    let pinch = 0;
    let lastTap = 0;
    let suppressTap = false;
    let hoverAt = 0;
    const el = this.canvas;
    el.style.touchAction = "none";

    const down = (e) => {
      el.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
      const now = performance.now();
      if (now - lastTap < 320) {
        suppressTap = true; // a double tap opens / closes the turbine; it is not a tap on an object
        this.clearPick();
        this.command(this.rig.walk ? "walk_stop" : this.lookInside?.u > 0.5 ? "close_inside" : "look_inside");
      }
      lastTap = now;
    };
    const move = (e) => {
      const rect = el.getBoundingClientRect();
      this.rig.setPointer(((e.clientX - rect.left) / rect.width) * 2 - 1, ((e.clientY - rect.top) / rect.height) * 2 - 1);
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        // plain mouse hover: show a hand over anything that has a description
        const t = performance.now();
        if (e.pointerType === "mouse" && t - hoverAt > 90) {
          hoverAt = t;
          el.style.cursor = this.#hit(e.clientX, e.clientY) ? "pointer" : "grab";
        }
        return;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1 && this.rig.walk) {
        this.rig.lookAround((e.clientX - prev.x) / rect.width, (e.clientY - prev.y) / rect.height);
      } else if (pointers.size === 1) {
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
      const start = taps.get(e.pointerId);
      taps.delete(e.pointerId);
      // a short press that hardly moved is a tap, not a drag
      if (start && !suppressTap && pointers.size === 0 && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 9 && performance.now() - start.t < 450) {
        setTimeout(() => !suppressTap && this.#pick(e.clientX, e.clientY), 0);
      }
      if (pointers.size === 0) setTimeout(() => (suppressTap = false), 340);
    };
    const wheel = (e) => {
      e.preventDefault();
      if (this.rig.walk) this.scrubWalk(this.rig.walk.s + e.deltaY * 0.00035);
      else this.rig.nudge(0, 0, Math.exp(-e.deltaY * 0.0012));
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
    for (const r of roots) r.traverse((o) => o.isMesh && !o.userData.isAnnotation && !o.userData.isOutline && !o.userData.isEdges && meshes.push(o));

    for (const mesh of meshes) {
      for (const child of [...mesh.children]) {
        if (child.userData.isOutline || child.userData.isEdges) {
          mesh.remove(child);
          if (child.userData.isEdges) child.geometry.dispose();
          child.material.dispose();
        }
      }
      mesh.material?.dispose?.();
      const role = roleOf(mesh);
      const whiteExterior = this.explorerEnabled && (role === "body" || role.startsWith("band"));
      mesh.material = createMaterial(theme, whiteExterior ? "body" : role);
      if (whiteExterior) mesh.material.color.set(0xffffff);
      if (mesh.material.isMeshStandardMaterial) mesh.material.envMapIntensity = whiteExterior ? .4 : .9;
      if (!this.explorerEnabled) applyBands(mesh, theme);
      mesh.castShadow = !isDrawnTheme(theme) && !mesh.userData.neighbour;

      const plain = !mesh.isInstancedMesh && !mesh.userData.part;
      if (theme === "cartoon" && plain) addOutline(mesh, mesh.userData.neighbour ? 0.002 : 0.0035);
      if (isDrawnTheme(theme) && plain) addEdges(mesh, drawnColours(theme).line, theme === "xray" ? 0.7 : 0.9);
    }
    if (this.nodes) clearLit(this.nodes.root);
    if (this.foundation) this.foundation.visible = theme === "xray";

    this.setXray?.(isDrawnTheme(theme));
    this.lookInside?.setTheme(theme);
    this.lookInside?.rebind();
    this.walkHatch?.(Boolean(this.rig.walk));
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

  /** The demo hour from the server's override (null = real time); a running time-lapse takes priority. */
  setServerHour(hour) {
    this.serverHour = hour == null ? null : londonHourToDate(hour);
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
    return this.timeOverride ?? this.serverHour ?? new Date();
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
    // inside the turbine the daylight is mostly shut out; the lamps do the work
    const inside = this.interior.f;
    this.sun.intensity *= 1 - 0.7 * inside;
    this.hemi.color.copy(sky.hemiSky);
    this.hemi.groundColor.copy(sky.hemiGround);
    const fill = nightReadability(sky, this.rig.walk ? inside : Math.max(inside, this.rig.isInside ? 1 : 0));
    this.hemi.color.lerp(NIGHT_SKY_FILL, fill.weight * 0.75);
    this.hemi.groundColor.lerp(NIGHT_GROUND_FILL, fill.weight * 0.5);
    this.hemi.intensity = (sky.hemiIntensity + fill.ambient) * (1 - 0.88 * inside);
    this.nightFill.intensity = fill.fill;
    this.camera.getWorldDirection(this._fillDirection ||= new THREE.Vector3());
    this.nightFill.position.copy(this.camera.position);
    this.nightFill.position.y += 80;
    this.nightFill.target.position.copy(this.camera.position).addScaledVector(this._fillDirection, 50);

    if (!this.scene.fog) this.scene.fog = new THREE.Fog(0xffffff, 100, 3000);
    this.scene.fog.color.copy(sky.horizon);
    // The cartoon look keeps the weather's haze light, so the houses never melt into mist.
    const clear = this.theme === "cartoon";
    this.scene.fog.near = clear ? Math.max(sky.fogNear, 400) : sky.fogNear;
    this.scene.fog.far = clear ? Math.max(sky.fogFar, 2400) : sky.fogFar;
    this.renderer.toneMappingExposure = 0.92 + 0.25 * (1 - sky.day);

    this.scene.environmentIntensity = (this.envBase ?? 1) * (1 - 0.92 * inside);
    this.world.update({ time, sky, sunDir, windMs: this.env.windMs, windVec, rain: this.env.rain, litFraction: this.env.litFraction });
    this.skyNow = sky;

    // Re-light the reflections on the turbine when the sky has changed enough to matter.
    const last = this.lastEnvMap;
    if (!this.envMap || Math.abs(sky.elevationDeg - last.elevation) > 3 || Math.abs(sky.cloudCover - last.cloud) > 0.15 || time - last.at > 600) {
      this.envMap?.dispose();
      this.envMap = this.pmrem.fromScene(this.envScene, 0.02, 1, 6000).texture;
      this.scene.environment = this.envMap;
      this.envBase = 0.55 + 0.45 * sky.day;
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
  async command(action, value) {
    if (!this.lookInside) return;
    if (this.story) {
      const chapter = { blades: 0, hub: 0, hero: 0, spin_blades: 0, look_inside: 1, fly_to_nacelle: 1, tower_inside: 3, walk_start: 3, walk_to: 3, tower: 3, base: 4, fly_to_base: 4, overview: 5, close_inside: 5 }[action];
      if (chapter != null) this.story.seekChapter(chapter);
      return;
    }
    if (action !== "xray_climb") this.endXrayClimb();
    if (action === "tour") return this.tour?.start(value ?? {});
    this.tour?.stop();
    const token = ++this.commandToken;
    const still = () => token === this.commandToken && !this.disposed;
    // anything but a walk command takes the visitor back out of the turbine first
    if (this.rig.walk && !action.startsWith("walk_")) this.#leaveWalk();
    switch (action) {
      case "walk_start":
        return this.startWalk({ duration: Number.isFinite(value) ? value : 44 });
      case "walk_to": {
        if (!this.rig.walk) await this.startWalk({ auto: false });
        this.scrubWalk(value);
        return;
      }
      case "walk_stop":
        return this.stopWalk();
      case "xray_climb":
        return this.#xrayClimb(still);
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

  // ---------------------------------------------------------------- the X-ray climb

  /**
   * College's "Go inside": the turbine turns see-through and the camera climbs from the piles
   * to the hub (three/xrayClimb.js), lighting up the parts at each stop. `xrayClimbState.stop`
   * says which stop it's at, for the captions and labels.
   */
  async #xrayClimb(still) {
    if (this.lookInside.u > 0.02) this.lookInside.close(0.8);
    if (!this.xrayClimbState) this.xrayClimbState = { stop: 0, from: this.theme };
    this.applyTheme("xray");
    for (let i = 0; i < XRAY_STOPS.length; i++) {
      if (!still()) return;
      const stop = XRAY_STOPS[i];
      this.xrayClimbState.stop = i;
      lightParts(this.nodes.root, stop.lit, XRAY.glow);
      await this.rig.flyTo(`xray-${stop.id}`, { duration: stop.fly });
      if (!still()) return;
      // Hold, circling slowly round what's being explained.
      const rig = this.rig;
      const offset = rig.pos.clone().sub(rig.target);
      const turn = { a: 0 };
      await new Promise((resolve) => {
        this.xrayDrift = gsap.to(turn, {
          a: stop.drift,
          duration: stop.hold,
          ease: "sine.inOut",
          onUpdate: () => rig.pos.copy(offset).applyAxisAngle(THREE.Object3D.DEFAULT_UP, turn.a).add(rig.target),
          onComplete: resolve,
          onInterrupt: resolve,
        });
      });
    }
  }

  /** Back to the screen's own look when the climb is over. */
  endXrayClimb() {
    if (!this.xrayClimbState) return;
    this.xrayDrift?.kill();
    const { from } = this.xrayClimbState;
    this.xrayClimbState = null;
    this.applyTheme(from);
  }

  // ---------------------------------------------------------------- walking through the turbine

  /** Applies the "inside the turbine" lighting amount (daylight shut out, lamps on). */
  #applyInterior() {
    this.envDirty = true;
    this.headlamp.intensity = 0.7 * this.interior.f;
    for (const l of this.nacelleLights ?? []) l.intensity = 3 * this.interior.f;
  }

  setExplorerInside(active) {
    this.interior.f = active ? .35 : 0;
    this.#applyInterior();
    this.headlamp.intensity = active ? 2 : 0;
    for (const light of this.nacelleLights ?? []) light.intensity = active ? 18 : 0;
  }

  /** Fades the interior lighting out when leaving (while walking it follows how far in you are). */
  #setInterior(on, seconds = 1.6) {
    gsap.killTweensOf(this.interior);
    gsap.to(this.interior, { f: on ? 1 : 0, duration: seconds, ease: "power2.inOut", onUpdate: () => this.#applyInterior() });
  }

  /**
   * First-person walk: in at the tower door, up the ladder, into the machine room.
   * With `auto` the camera walks itself over `duration` seconds; without it, progress is
   * driven from outside (a phone slider, the mouse wheel).
   */
  async startWalk({ duration = 44, auto = true, from = 0 } = {}) {
    this.walkTween?.kill();
    if (this.lookInside.u > 0.01) this.lookInside.close(0.6);
    this.rig.startWalk(from);
    this.annotations?.show([]);
    this.walkState = { s: from };
    this.callbacks.onWalk?.(from, walkHeight(from));
    if (!auto) return;
    await new Promise((resolve) => {
      this.walkTween = gsap.to(this.walkState, {
        s: 1,
        duration,
        ease: "sine.inOut",
        onUpdate: () => this.#walkUpdated(),
        onComplete: resolve,
        onInterrupt: resolve,
      });
    });
  }

  #walkUpdated() {
    const s = this.walkState.s;
    this.rig.setWalk(s);
    this.walkHatch?.(true, this.rig.walk.s > 0.93);
    // daylight is shut out as you step through the door (around 8-11% of the way)
    gsap.killTweensOf(this.interior);
    this.interior.f = THREE.MathUtils.smoothstep(s, 0.075, 0.115);
    this.#applyInterior();
    this.callbacks.onWalk?.(s, walkHeight(s));
  }

  /** Jump to / scrub to a point on the walk (stops the automatic walk). */
  scrubWalk(s) {
    if (!this.rig.walk) return;
    this.walkTween?.kill();
    this.walkState = this.walkState ?? { s: 0 };
    this.walkState.s = Math.min(1, Math.max(0, s));
    this.#walkUpdated();
  }

  #leaveWalk() {
    this.walkHatch?.(false);
    this.walkTween?.kill();
    this.#setInterior(false, 1.2);
    this.rig.walk && this.rig.endWalk("hero");
    this.callbacks.onWalk?.(null, 0);
  }

  async stopWalk() {
    if (!this.rig.walk) return;
    this.walkHatch?.(false);
    this.walkTween?.kill();
    this.#setInterior(false, 1.6);
    this.callbacks.onWalk?.(null, 0);
    await this.rig.endWalk("hero");
  }

  // ---------------------------------------------------------------- tapping things

  /** First thing under a screen point that has a description: { id, hit } or null. */
  #hit(clientX, clientY) {
    if (!this.nodes) return null;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects([this.nodes.root, this.neighbour, this.world.group].filter(Boolean), true);
    for (const hit of hits) {
      let ok = true;
      for (let o = hit.object; o; o = o.parent) {
        if (o.visible === false || o.userData.noPick) ok = false;
      }
      if (!ok) continue;
      const id = resolveHotspot(hit, { neighbour: this.neighbour });
      if (id) return { id, hit, ray: this.raycaster.ray.direction.clone() };
    }
    // nothing solid: tapping the sky above the horizon describes the sky
    const dir = this.raycaster.ray.direction;
    if (dir.y > 0.02 && !this.rig.walk) return { id: "sky", hit: null, ray: dir.clone() };
    return null;
  }

  #pick(clientX, clientY) {
    const found = this.#hit(clientX, clientY);
    if (!found) {
      this.clearPick();
      return;
    }
    const { id, hit, ray } = found;
    if (hit) {
      // remember where on the object it was tapped, so the marker follows it as it moves or turns
      this.pickTarget = { object: hit.object, local: hit.object.worldToLocal(hit.point.clone()) };
    } else {
      this.pickTarget = { world: this.camera.position.clone().addScaledVector(ray, 800) };
    }
    const rect = this.canvas.getBoundingClientRect();
    this.callbacks.onPick?.({ id, x: clientX - rect.left, y: clientY - rect.top });
  }

  clearPick() {
    if (!this.pickTarget) return;
    this.pickTarget = null;
    this.callbacks.onPick?.(null);
  }

  // ---------------------------------------------------------------- story stages and data tags

  /**
   * One beat of a story: camera / effect, drawn measurements, wind streamlines, time of day.
   * @param {{ action?: string, value?: number, annotations?: string[], wind?: boolean, lapse?: [number, number, number] }} stage
   */
  applyStage(stage = {}) {
    if (stage.action !== "tour") this.tour?.stop();
    if (stage.action !== "xray_climb") this.endXrayClimb?.();
    this.windViz = stage.wind ? 1 : 0;
    if (stage.lapse) {
      const [from, to, seconds] = stage.lapse;
      this.timeLapse(from, to, seconds, () => this.setTimeOfDay(null));
    } else if (this.timeLapseTween?.isActive()) {
      this.timeLapseTween.kill();
      this.setTimeOfDay(null);
    }
    const action = stage.action ? this.command(stage.action, stage.value) : undefined;
    this.annotations?.show(this.rig.walk ? [] : stage.annotations ?? []);
    return action;
  }

  /** The data tags to show: [{ id, anchor }] where anchor names an entry of this.anchors. */
  setTags(defs = []) {
    this.tagDefs = defs;
  }

  /** React hands over the DOM node for each tag id; the scene positions it every frame. */
  bindTags(map) {
    this.tagEls = map;
  }

  /**
   * Card sizes and the screen areas cards must not cover (captions, panels, the QR...:
   * anything marked data-keepout), in canvas pixels. Layout reads are slow, so this runs
   * every few frames, before any of the frame's writes.
   */
  #measureTagLayout() {
    const origin = this.canvas.getBoundingClientRect();
    this.tagSizes = new Map();
    for (const [id, el] of this.tagEls) {
      const card = el.firstElementChild?.firstElementChild;
      if (card) this.tagSizes.set(id, { w: card.offsetWidth, h: card.offsetHeight });
    }
    this.labelSizes = new Map();
    for (const [id, el] of this.labelEls) {
      const card = el.firstElementChild?.firstElementChild;
      if (card) this.labelSizes.set(id, { w: card.offsetWidth, h: card.offsetHeight });
    }
    this.keepouts = [...document.querySelectorAll("[data-keepout]")]
      .map((node) => node.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height }));
  }

  #updateTags() {
    if (!this.tagEls.size || !this.size) return;
    const v = new THREE.Vector3();
    const shown = new Set();
    // Cards hang above their anchor point. One that would cover the story's text or another
    // card (earlier tags win) fades out until there's room, with a little slack so it
    // doesn't flicker at the edge.
    const placed = [];
    const overlaps = (a, b, pad) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
    for (const def of this.tagDefs) {
      const el = this.tagEls.get(def.id);
      const obj = this.anchors[def.anchor];
      if (!el || !obj) continue;
      shown.add(def.id);
      obj.getWorldPosition(v);
      const dist = v.distanceTo(this.camera.position);
      v.project(this.camera);
      let visible = v.z < 1 && Math.abs(v.x) < 1.02 && Math.abs(v.y) < 1.02 && dist > 3 && !this.rig.walk;
      const x = (v.x * 0.5 + 0.5) * this.size.w;
      const y = (-v.y * 0.5 + 0.5) * this.size.h;
      const size = this.tagSizes.get(def.id);
      if (visible && size) {
        const box = { x: x - size.w / 2, y: y - size.h, w: size.w, h: size.h };
        const pad = el.dataset.on === "1" ? 0 : 16;
        if ([...this.keepouts, ...placed].some((r) => overlaps(box, r, pad))) visible = false;
        else placed.push(box);
      }
      el.dataset.on = visible ? "1" : "0";
      if (visible) el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
    // the marker for the tapped thing
    const marker = this.tagEls.get("__pick");
    if (marker) {
      shown.add("__pick");
      const pt = this.pickTarget;
      if (pt) {
        if (pt.object) pt.object.localToWorld(v.copy(pt.local));
        else v.copy(pt.world);
        v.project(this.camera);
        const visible = v.z < 1 && Math.abs(v.x) < 1.02 && Math.abs(v.y) < 1.02;
        marker.dataset.on = visible ? "1" : "0";
        if (visible) marker.style.transform = `translate3d(${((v.x * 0.5 + 0.5) * this.size.w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * this.size.h).toFixed(1)}px, 0)`;
      } else marker.dataset.on = "0";
    }
    for (const [id, el] of this.tagEls) if (!shown.has(id)) el.dataset.on = "0";
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
      candidates.push({ id: label.id, el, dist, visible, x: (v.x * 0.5 + 0.5) * this.size.w, y: (-v.y * 0.5 + 0.5) * this.size.h });
    }
    candidates.sort((a, b) => a.dist - b.dist);
    const placed = [];
    const minGap = Math.max(120, this.size.w * 0.09);
    for (const c of candidates) {
      const size = this.labelSizes?.get(c.id);
      const box = size && { x: c.x - size.w / 2, y: c.y - size.h, w: size.w, h: size.h };
      const overlapsNews = box && this.keepouts?.some((r) =>
        box.x < r.x + r.w + 8 && r.x < box.x + box.w + 8 && box.y < r.y + r.h + 8 && r.y < box.y + box.h + 8
      );
      const clear = c.visible && !overlapsNews && placed.every((p) => Math.abs(p.x - c.x) > minGap * 1.6 || Math.abs(p.y - c.y) > minGap * 0.6);
      c.el.style.opacity = clear ? fade.toFixed(3) : "0";
      c.el.style.visibility = clear ? "visible" : "hidden";
      if (clear) {
        placed.push(c);
        c.el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0)`;
      }
    }
  }

  // ---------------------------------------------------------------- frame

  /** Skip drawing while something else covers the whole screen (the live real-world view). */
  /**
   * The blueprint look as an X-ray: no landscape or sky, just the line-drawn turbine on an
   * engineering grid over deep navy, so its structure is the only thing to look at.
   */
  setXray(on) {
    this.xray = on;
    this.world.group.visible = !on;
    this.sky.visible = !on;
    const colours = drawnColours(this.theme);
    if (on && this.xrayGrid && this.xrayGrid.userData.theme !== this.theme) {
      this.scene.remove(this.xrayGrid);
      this.xrayGrid.traverse((o) => (o.geometry?.dispose(), o.material?.dispose?.()));
      this.xrayGrid = null;
    }
    if (on && !this.xrayGrid) {
      const grid = new THREE.Group();
      grid.name = "XrayGrid";
      grid.userData.theme = this.theme;
      const major = new THREE.GridHelper(2400, 48, colours.lineDim, colours.lineDim);
      const minor = new THREE.GridHelper(2400, 240, colours.paperLight, colours.paperLight);
      for (const [g, opacity] of [[major, 0.55], [minor, 0.35]]) {
        g.material.transparent = true;
        g.material.opacity = opacity;
        g.material.depthWrite = false;
        grid.add(g);
      }
      minor.position.y = -0.05;
      this.xrayGrid = grid;
      this.scene.add(grid);
    }
    if (this.xrayGrid) this.xrayGrid.visible = on;
    this.scene.background = on ? new THREE.Color(colours.paper) : null;
    this.envDirty = true;
  }

  setPaused(paused) {
    this.paused = paused;
  }

  #tick(now) {
    // Skip display refreshes until the next frame is due (2 ms slack for vsync jitter); the
    // timer then spans the skipped ones, so the rotor still turns at the true rpm.
    if (this.frameInterval && now - this.lastFrameAt < this.frameInterval - 2) return;
    this.lastFrameAt = now;
    this.timer.update();
    if (this.paused) return;
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
        const k = (Math.sin(t * 0.07) * 0.5 + 0.5) * Math.max(this.lookInside.u, this.xrayClimbState ? 1 : 0);
        this.lift.position.y = 3 + k * 82;
      }
      blinkAviationLight(this.aviationLights, t, this.theme);
      this.lookInside?.updatePlanes();
      const showInterior = this.interior.f > 0.01 || (this.lookInside?.u ?? 0) > 0.01 || Boolean(this.rig.walk) || this.theme === "xray";
      this.interiors.towerInterior.visible = showInterior;
      this.interiors.nacelleInterior.visible = showInterior;
      if (this.rig.walk) this.walkHatch?.(true, this.rig.walk.s > 0.93);
      this.#updateScan(realDt);
      // The scan has the neighbouring turbine in it already, and the X-ray is about this
      // machine alone.
      if (this.neighbour) this.neighbour.visible = !this.scanShown && this.theme !== "xray";
    }

    this.envClock += dt;
    if (this.envDirty || this.timeOverride || this.serverHour || this.envClock > 0.5) {
      this.#applyEnvironment(t);
      // X-ray: the grid fades into the navy instead of the day's haze.
      if (this.xray && this.scene.fog) {
        this.scene.fog.color.set(drawnColours(this.theme).paper);
        this.scene.fog.near = 300;
        this.scene.fog.far = 1600;
      }
      this.envDirty = false;
      this.envClock = 0;
    }
    this.sky.userData.uniforms.uTime.value = t;
    this.world.tick(t);
    this.fx.update({ time: t, camera: this.camera, rain: this.env.rain, windMs: this.env.windMs, windVec: this._windVec ?? new THREE.Vector2(1, 0), windViz: this.windViz, dt });

    this.story?.update(realDt);
    this.tour?.update(realDt);
    if (this.explorer) this.explorer.update(dt);
    else this.rig.update(dt);
    if (Boolean(this.rig.walk) !== this.walkFraming) {
      this.walkFraming = Boolean(this.rig.walk);
      const { w, h } = this.size;
      const shift = !this.walkFraming && w / h > 1.15 ? this.frameShift : 0;
      if (shift) this.camera.setViewOffset(w, h, -shift * w, 0, w, h);
      else this.camera.clearViewOffset();
    }
    const baseFov = this.size.w / this.size.h < 0.8 ? 52 : 38;
    const fov = this.explorer?.inside ? 65 : baseFov + (55 - baseFov) * (this.rig.walk ? THREE.MathUtils.smoothstep(this.rig.walk.s, 0.93, 1) : 0);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, fov, 1 - Math.exp(-dt * 4));
      this.camera.updateProjectionMatrix();
    }
    this.sky.position.copy(this.camera.position);
    this.layoutFrame = (this.layoutFrame ?? 0) + 1;
    if (this.layoutFrame % 10 === 1 || !this.tagSizes) this.#measureTagLayout();
    this.#updateLabels();
    this.#updateTags();
    if (this.warming) return;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.explorer?.dispose();
    this.story?.dispose();
    this.tour?.dispose();
    this.renderer.setAnimationLoop(null);
    this.resizeObserver?.disconnect();
    this.unbindPointer?.();
    gsap.killTweensOf(this);
    this.splat?.dispose?.();
    this.spark?.dispose?.();
    if (this.lookInside) gsap.killTweensOf(this.lookInside);
    this.rig._tween?.kill();
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => m.dispose?.());
    });
    this.pmrem?.dispose();
    this.walkTween?.kill();
    gsap.killTweensOf(this.interior);
    this.envMap?.dispose();
    this.renderer.dispose();
  }
}
