import * as THREE from "three";
import { chapterAt, chapterStart, railProgress, STORY_SECONDS } from "./storyTimeline.ts";
import { buildStoryHome } from "./storyHome.js";
import { buildEvScene, EV_SHOT } from "./evScene.js";

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const up = new THREE.Vector3(0, 1, 0);

function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(221,255,230,1)");
  gradient.addColorStop(0.2, "rgba(126,255,186,0.85)");
  gradient.addColorStop(1, "rgba(80,255,165,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Opt-in cinematic director. Existing screen shots and geometry are left alone.
 * With `autoplay` (the story screen) it runs from the start and loops for good. Without it
 * (a "tour": one chapter of another screen's story) it rests until start(), plays once
 * through, and stop() hands the camera and everything it touched back.
 */
export class StoryRail {
  constructor(scene, interiors, { autoplay = true } = {}) {
    this.scene = scene;
    this.active = autoplay;
    this.interiors = interiors;
    this.time = 0;
    this.eye = v(0, 0, 0);
    this.look = v(0, 0, 0);
    this.point = v(0, 0, 0);
    this.matrix = new THREE.Matrix4();
    this.rotation = new THREE.Quaternion();
    this.scale = v(1, 1, 1);
    this.frozen = false;
    this.frameSeconds = 0;
    this.frameCount = 0;
    this.fps = 0;
    const params = new URLSearchParams(window.location.search);
    if (params.has("storyTime")) {
      const time = Number(params.get("storyTime"));
      if (Number.isFinite(time)) { this.time = THREE.MathUtils.clamp(time, 0, STORY_SECONDS - 0.001); this.frozen = true; }
    }
    if (autoplay) scene.rig.returnAfter = 3;
    this.group = new THREE.Group();
    this.group.name = "StoryEnergy";
    scene.scene.add(this.group);
    scene.shown.yaw = scene.live.yaw;
    scene.nodes.yaw.rotation.y = scene.shown.yaw;
    scene.towerPivot.rotation.y = scene.shown.yaw;
    this.neighbourVisible = scene.neighbour.visible;
    const destination = scene.world.pylons.energyRoute[60].clone().add(v(40, 0, -65));
    this.house = scene.world.estate.houses.reduce((best, house) => v(house.x, 0, house.z).distanceToSquared(destination) < v(best.x, 0, best.z).distanceToSquared(destination) ? house : best);
    this.houseAt = (x, y, z) => v(x, y, z).applyAxisAngle(up, this.house.rot).add(v(this.house.x, 0, this.house.z));
    this.window = this.houseAt(-1.4, 2.5, 4.03);
    this.home = buildStoryHome(v(this.house.x, 1000, this.house.z));
    scene.scene.add(this.home.group);
    this.buildPaths();
    this.buildGenerator();
    this.buildBranches();
    if (this.active) this.update(0);
    else this.#rest();
  }

  /**
   * Plays the journey from the start, as one chapter of another story. With `endAt`
   * (seconds) it stops there and holds the view, for a screen that ends the journey its
   * own way. With `ending: "ev"` (community) the view then moves to the street outside the
   * home, where a neighbour plugs an electric car into a street charger (evScene.js).
   */
  start({ endAt = null, ending = null } = {}) {
    this.active = true;
    this.endAt = endAt;
    this.ending = ending;
    this.endingTime = 0;
    if (ending === "ev") this.#ensureEv().reset();
    this.savedReturnAfter = this.scene.rig.returnAfter;
    this.scene.rig.returnAfter = 3;
    this.seek(0);
  }

  /** Ends a tour: the scene and the camera go back to how the screen's own story left them. */
  stop() {
    if (!this.active) return;
    this.active = false;
    this.endAt = null;
    if (this.ev) this.ev.group.visible = this.evFeed.visible = this.evFeedGlow.visible = false;
    if (this.dusk) {
      this.dusk = false;
      this.scene.timeLapseTween?.kill();
      this.scene.setTimeOfDay(null);
    }
    this.scene.rig.returnAfter = this.savedReturnAfter ?? this.scene.rig.returnAfter;
    this.#rest();
    Object.assign(this.scene.rig, { rail: false, railInside: false });
    this.scene.rig.jumpTo("overview");
  }

  /** The street-charger ending, built the first time it's needed, on the journey's home. */
  #ensureEv() {
    if (this.ev) return this.ev;
    this.ev = buildEvScene();
    this.ev.group.position.set(this.house.x, 0, this.house.z);
    this.ev.group.rotation.y = this.house.rot;
    this.scene.scene.add(this.ev.group);
    // The power line down the street carries on to the charger.
    const junction = this.scene.world.pylons.energyRoute[60];
    const base = this.houseAt(this.ev.charger.x, 0.4, this.ev.charger.z);
    const top = this.houseAt(this.ev.charger.x, 1.0, this.ev.charger.z - 0.16);
    const curve = new THREE.CatmullRomCurve3([junction.clone(), v(junction.x, 0.4, junction.z), this.houseAt(this.ev.charger.x - 1, 0.4, -9.5), base, top]);
    const material = this.cable.material.clone();
    material.uniforms.uLength.value = curve.getLength();
    material.uniforms.uYaw.value = 0;
    material.uniforms.uOn.value = 1;
    this.evFeed = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.16, 6, false), material);
    this.evFeed.renderOrder = 20;
    this.evFeedGlow = new THREE.Sprite(this.glows[0].material.clone());
    this.evFeedGlow.renderOrder = 22;
    this.evFeedGlow.scale.setScalar(1.6);
    this.evFeed.visible = this.evFeedGlow.visible = false;
    this.scene.scene.add(this.evFeed, this.evFeedGlow);
    this.evFeedCurve = curve;
    return this.ev;
  }

  /** The street-charger ending: the camera settles on the street and the scene plays. */
  #playEv(dt) {
    const first = this.endingTime === 0;
    this.endingTime += dt;
    const t = this.endingTime;
    if (first) {
      this.ev.group.visible = this.evFeed.visible = this.evFeedGlow.visible = true;
      // Dusk falls, so the windows and lamps come on (unless it's dark already).
      const hour = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }));
      if (hour >= 7 && hour < 18) {
        this.dusk = true;
        this.scene.timeLapse(hour, 19.6, 7);
      }
    }
    this.ev.update(t, dt, this.scene.camera);
    const k = THREE.MathUtils.smoothstep(t, 0, 2.6);
    const look = this.ev.group.localToWorld(EV_SHOT.look.clone());
    // Settle on the street, then push in slowly towards the car.
    const eye = this.ev.group.localToWorld(EV_SHOT.eye.clone()).lerp(look, 0.1 * THREE.MathUtils.smoothstep(t, 3, 16));
    this.eye.lerp(eye, k);
    this.look.lerp(look, k);
    const reach = THREE.MathUtils.smoothstep(t, 0.6, 4.2);
    const length = this.evFeedCurve.getLength();
    this.evFeed.material.uniforms.uFront.value = reach * length;
    this.evFeed.material.uniforms.uTime.value = this.time + t;
    this.evFeedCurve.getPointAt(Math.max(0.001, reach), this.evFeedGlow.position);
    // The glow rides the line to the charger, then fades.
    this.evFeedGlow.material.opacity = 1 - THREE.MathUtils.smoothstep(t, 4.2, 5.2);
  }

  /** Everything the journey shows, hidden; everything it hides, shown. */
  #rest() {
    const scene = this.scene;
    this.home.group.visible = false;
    this.group.visible = false;
    scene.world.group.visible = scene.nodes.root.visible = true;
    scene.neighbour.visible = this.neighbourVisible;
    this.magnetRing.visible = this.coilGlow.visible = false;
    scene.nodes.generatorRotor.visible = true;
    for (const cover of this.generatorCover) cover.visible = true;
    scene.lookInside.u = 0;
    scene.lookInside.apply();
    scene.windViz = 0;
  }

  buildPaths() {
    const { nodes, towerPivot, world } = this.scene;
    nodes.root.updateMatrixWorld(true);
    this.transformerTarget = new THREE.Box3().setFromObject(nodes.transformer).getCenter(v(0, 0, 0));
    const yaw = (x, y, z) => nodes.yaw.localToWorld(v(x, y, z));
    const tower = (x, y, z) => towerPivot.localToWorld(v(x, y, z));
    // Camera controls are one curve. Boundary indices map captions to time on that curve.
    const points = [];
    const boundaries = [];
    const add = (point) => { points.push(point); return points.length - 1; };
    boundaries.push(add(yaw(94, 16, 52)));
    add(yaw(66, 21, 42)); add(yaw(38, 16, 28));
    boundaries.push(add(yaw(-10, 10, 15)));
    add(yaw(-9, 7, 11)); add(yaw(-7, 5.5, 7)); add(yaw(-5, 4.8, 5));
    boundaries.push(add(yaw(-3, 4.6, 4.5)));
    add(yaw(-3, 0, 5));
    boundaries.push(add(tower(4.6, 78, 5.4)));
    add(tower(4.1, 62, 5)); add(tower(3.6, 42, 4.6)); add(tower(3.3, 22, 4));
    boundaries.push(add(tower(3, 6, 4)));
    add(v(-1, 9, 13)); add(v(-16, 11, 11)); boundaries.push(add(v(-25, 14, -10)));
    add(v(-17, 25, -100)); add(v(-12, 39, -245));
    const line = world.pylons.energyRoute.slice(36, 61);
    boundaries.push(add(line[0].clone().add(v(-12, 9, 15))));
    for (let i = 2; i < line.length; i += 2) add(line[i].clone().add(v(-12, 9, 15)));
    boundaries.push(points.length - 1);
    add(this.houseAt(-20, 32, 65)); add(this.houseAt(-9, 20, 45));
    boundaries.push(add(this.houseAt(-1.4, 7, 15)));
    boundaries.push(add(this.window.clone().add(v(0, 0.3, 1.2))));
    // The window dissolve masks the transit to the separate room on the same rail.
    add(this.home.at(-1.6, 3.7, 9)); add(this.home.at(-1.5, 3.5, 8));
    boundaries.push(add(this.home.at(-1.4, 3.2, 7)));
    add(this.home.at(-1.2, 2.7, 5)); add(this.home.at(0, 2.3, 3.5));
    boundaries.push(add(this.home.at(2.8, 2.1, 2.7)));
    add(this.home.at(2.5, 2.1, 1.9));
    boundaries.push(add(this.home.at(1.1, 2.2, 1.8)));
    add(this.home.at(1.5, 2.6, 2.4));
    boundaries.push(add(this.home.at(2.2, 3.1, 3.4)));
    this.railTimes = [0, 11, 23, 30, 40, 46, 50, 64, 76, 78, 80, 88, 94, 100];
    this.cameraCurve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    this.cameraCurve.arcLengthDivisions = 2400;
    const lengths = this.cameraCurve.getLengths(2400);
    this.cameraLength = lengths[lengths.length - 1];
    this.cameraDistances = boundaries.map((index) => lengths[Math.round(index / (points.length - 1) * 2400)] / this.cameraLength);
    this.baseCameraPoints = points.map((point) => point.clone());
    this.baseYaw = this.scene.shown.yaw;
    this.lastYaw = this.baseYaw;

    // Keep exact existing pylon cable samples and the existing tower cable curve.
    const route = [yaw(2.35, 0.65, 1), yaw(1.8, 0.5, 0.9), tower(0.9, 89, 0.2)];
    const markers = [0, 0, 2, 2];
    for (let i = 1; i <= 80; i++) route.push(towerPivot.localToWorld(this.interiors.cablePath.getPointAt(i / 80)));
    const top78 = route.findIndex((point) => point.y < 78);
    markers[3] = top78;
    route.push(tower(0, 2.4, -1.2));
    markers.push(route.length - 1);
    route.push(v(-9, 1, -8), this.transformerTarget.clone().add(v(0, 1.4, 0)));
    markers.push(route.length - 1);
    route.push(v(-12, 0.35, -17), v(-8, 0.35, -160), v(line[0].x, 0.35, line[0].z), line[0].clone());
    markers.push(route.length - 1);
    for (const point of line.slice(1)) route.push(point.clone());
    markers.push(route.length - 1);
    route.push(v(line.at(-1).x, 0.4, line.at(-1).z), this.houseAt(-1.4, 0.4, 6), this.houseAt(-1.4, 1.1, 4.15));
    markers.push(route.length - 1);
    route.push(this.window.clone()); markers.push(route.length - 1);
    route.push(this.home.cablePoints[0].clone()); markers.push(route.length - 1);
    for (const point of this.home.cablePoints.slice(1, 4)) route.push(point.clone());
    markers.push(route.length - 1);
    for (const point of this.home.cablePoints.slice(4, 8)) route.push(point.clone());
    markers.push(route.length - 1);
    route.push(this.home.cablePoints[8].clone()); markers.push(route.length - 1);
    this.energyCurve = new THREE.CurvePath();
    // CurvePath.getPoint already uses exact segment lengths; avoid a second sampled remap.
    this.energyCurve.getPointAt = (u, target) => this.energyCurve.getPoint(u, target);
    this.energyCurve.getTangentAt = (u, target) => this.energyCurve.getTangent(u, target);
    const cumulative = [0];
    for (let i = 1; i < route.length; i++) {
      this.energyCurve.add(new THREE.LineCurve3(route[i - 1], route[i]));
      cumulative.push(cumulative[i - 1] + route[i].distanceTo(route[i - 1]));
    }
    this.energyLength = cumulative[cumulative.length - 1];
    this.energyDistances = markers.map((index) => cumulative[index] / this.energyLength);
    if (this.energyCurve.getPointAt(this.energyDistances[10]).distanceTo(this.home.cablePoints[0]) > 0.001) throw new Error("Story energy path must enter the room at the consumer unit");
    this.route = route;
    this.baseRoute = route.map((point) => point.clone());
    this.towerEnd = markers[4];
    this.uniforms = { uFront: { value: 0 }, uLength: { value: this.energyLength }, uTime: { value: 0 }, uOn: { value: 0 }, uYaw: { value: 0 }, uTowerEnd: { value: cumulative[this.towerEnd] }, uTransitStart: { value: cumulative[markers[9]] }, uTransitEnd: { value: cumulative[markers[10]] } };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      vertexShader: "varying float distanceAlong; uniform float uLength; uniform float uYaw; uniform float uTowerEnd; void main(){ distanceAlong=uv.x*uLength; float angle=uYaw*(1.0-smoothstep(uTowerEnd,uTowerEnd+6.0,distanceAlong)); vec3 p=position; p.x=position.x*cos(angle)+position.z*sin(angle); p.z=-position.x*sin(angle)+position.z*cos(angle); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }",
      fragmentShader: "varying float distanceAlong; uniform float uFront; uniform float uTime; uniform float uOn; uniform float uTransitStart; uniform float uTransitEnd; void main(){ if(distanceAlong>uTransitStart && distanceAlong<uTransitEnd) discard; float reached=1.0-smoothstep(uFront-0.8,uFront+0.8,distanceAlong); float pulse=pow(max(0.0,cos((distanceAlong-uTime*12.0)*0.5)),16.0); gl_FragColor=vec4(mix(vec3(0.12,0.65,0.37),vec3(0.7,1.0,0.85),pulse), reached*(0.22+0.78*pulse)*uOn); }",
    });
    // Separate tube segments keep the final room wiring thin at this close scale.
    const geometry = new THREE.TubeGeometry(this.energyCurve, 2400, 0.24, 6, false);
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const center = v(0, 0, 0);
    const roomStart = cumulative[markers[10]] / this.energyLength;
    this.roomStartMetres = cumulative[markers[10]];
    for (let i = 0; i < position.count; i++) if (uv.getX(i) >= roomStart) {
      this.energyCurve.getPointAt(uv.getX(i), center);
      this.point.fromBufferAttribute(position, i).sub(center).multiplyScalar(0.08).add(center);
      position.setXYZ(i, this.point.x, this.point.y, this.point.z);
    }
    this.cable = new THREE.Mesh(geometry, material);
    this.cable.name = "StoryContinuousEnergyPath";
    this.cable.renderOrder = 20;
    this.group.add(this.cable);
    this.pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd8ffe6, toneMapped: false, depthTest: false }), 9);
    this.pulses.renderOrder = 21;
    this.pulses.frustumCulled = false;
    this.group.add(this.pulses);
    const texture = glowTexture();
    this.glows = Array.from({ length: 9 }, () => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      sprite.renderOrder = 22;
      this.group.add(sprite);
      return sprite;
    });
  }

  buildBranches() {
    const junction = this.scene.world.pylons.energyRoute[60];
    const homes = [...this.scene.world.estate.houses].sort((a, b) => Math.hypot(a.x - this.house.x, a.z - this.house.z) - Math.hypot(b.x - this.house.x, b.z - this.house.z)).slice(1, 6);
    this.branches = homes.map((house) => {
      const curve = new THREE.CatmullRomCurve3([junction.clone(), v(junction.x, 0.4, junction.z), v(house.x, 0.4, house.z + 6), v(house.x, 2.5, house.z + 4)]);
      const material = this.cable.material.clone();
      material.uniforms.uLength.value = curve.getLength();
      material.uniforms.uYaw.value = 0;
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 0.16, 6, false), material);
      mesh.renderOrder = 20; this.group.add(mesh);
      const glow = new THREE.Sprite(this.glows[0].material.clone());
      glow.renderOrder = 22; glow.scale.setScalar(2); this.group.add(glow);
      return { mesh, glow, curve, length: curve.getLength() };
    });
    const halo = new THREE.Mesh(new THREE.RingGeometry(3.5, 3.7, 40), new THREE.MeshBasicMaterial({ color: 0x9dffc4, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthTest: false }));
    halo.rotation.x = -Math.PI / 2; halo.position.copy(v(this.house.x, 0.2, this.house.z));
    this.group.add(halo); this.houseHalo = halo;
  }

  buildGenerator() {
    const magnets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.3, 0.65), new THREE.MeshStandardMaterial({ color: 0x68ba90, metalness: 0.35, roughness: 0.6 }), 16);
    this.magnetRing = new THREE.Group();
    this.magnetRing.name = "StoryIllustrativeMagnets";
    this.magnetRing.position.set(2.25, 3, 0);
    for (let i = 0; i < magnets.count; i++) {
      const angle = i / magnets.count * Math.PI * 2;
      this.rotation.setFromAxisAngle(v(1, 0, 0), angle);
      this.matrix.compose(v(0, Math.cos(angle) * 2.12, Math.sin(angle) * 2.12), this.rotation, v(1, 1, 1));
      magnets.setMatrixAt(i, this.matrix);
    }
    this.magnetRing.add(magnets);
    this.scene.nodes.yaw.add(this.magnetRing);
    const coils = this.interiors.coils;
    this.generatorCover = [];
    this.scene.nodes.nacelleInternals.traverse((object) => {
      if (object.isMesh && object.userData.materialName === "M_Steel_Painted") this.generatorCover.push(object);
    });
    this.coilGlow = new THREE.InstancedMesh(coils.geometry.clone(), new THREE.MeshBasicMaterial({ color: 0xffb56b, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), coils.count);
    this.coilGlow.instanceMatrix.copy(coils.instanceMatrix);
    this.coilGlow.name = "StoryCoilGlow";
    this.scene.nodes.yaw.add(this.coilGlow);
    this.color = new THREE.Color();
  }

  seekChapter(index) { this.seek(chapterStart(index)); }

  seek(seconds) {
    this.time = THREE.MathUtils.clamp(seconds, 0, STORY_SECONDS - 0.001);
    this.scene.rig.resetUser();
    Object.assign(this.scene.rig.user, { yaw: 0, pitch: 0, zoom: 1 });
    this.update(0);
  }

  getState() {
    const beat = chapterAt(this.time);
    const fade = this.frozen ? 0 : Math.max(0, 1 - this.time / 0.65, (this.time - (STORY_SECONDS - 0.65)) / 0.65);
    const lead = this.energyCurve.getPointAt(this.uniforms.uFront.value / this.energyLength);
    const transition = THREE.MathUtils.smoothstep(this.time, 77.2, 78) * (1 - THREE.MathUtils.smoothstep(this.time, 80.2, 81.2));
    return { ...beat, ended: this.endAt != null && this.time >= this.endAt, seconds: this.time, fade: Math.max(fade, transition), blur: transition * 16, final: this.time >= 94, charging: this.time >= 90, camera: this.scene.camera.position.toArray(), rail: this.eye.toArray(), userOffset: { ...this.scene.rig.user }, energyMetres: this.uniforms.uFront.value, lead: lead.toArray(), leadNdc: lead.clone().project(this.scene.camera).toArray(), fps: this.fps, drawCalls: this.scene.renderer.info.render.calls, triangles: this.scene.renderer.info.render.triangles, magnetAngle: this.magnetRing.rotation.x };
  }

  update(dt) {
    if (!this.active) return;
    if (dt > 0) {
      this.frameCount++;
      this.frameSeconds += dt;
      if (this.frameSeconds >= 2) {
        this.fps = this.frameCount / this.frameSeconds;
        this.frameSeconds = this.frameCount = 0;
      }
    }
    if (!this.frozen) this.time = this.endAt != null ? Math.min(this.time + dt, this.endAt) : (this.time + dt) % STORY_SECONDS;
    const time = this.time;
    const scene = this.scene;
    if (Math.abs(scene.shown.yaw - this.lastYaw) > 0.001) {
      const delta = scene.shown.yaw - this.baseYaw;
      for (let i = 0; i <= 13; i++) this.cameraCurve.points[i].copy(this.baseCameraPoints[i]).applyAxisAngle(up, delta);
      this.cameraCurve.updateArcLengths();
      for (let i = 0; i <= this.towerEnd; i++) this.route[i].copy(this.baseRoute[i]).applyAxisAngle(up, delta);
      for (let i = 0; i <= this.towerEnd; i++) this.energyCurve.curves[i].updateArcLengths();
      this.energyCurve.updateArcLengths();
      this.uniforms.uYaw.value = delta;
      this.lastYaw = scene.shown.yaw;
    }
    const cameraU = railProgress(time, this.cameraDistances, this.railTimes);
    this.cameraCurve.getPointAt(cameraU, this.eye);
    const front = railProgress(time, this.energyDistances, this.railTimes) * this.energyLength;
    const lookAhead = time >= 80 ? 0.12 : time >= 23 && time < 40 ? 0.8 : 5;
    this.energyCurve.getPointAt(Math.max(0, Math.min(1, (front + lookAhead) / this.energyLength)), this.look);
    scene.nodes.yaw.localToWorld(this.point.set(time < 11 ? 4.6 : 2.35, 3, 0));
    this.look.lerp(this.point, 1 - THREE.MathUtils.smoothstep(time, 21, 25));
    const atTransformer = THREE.MathUtils.smoothstep(time, 39, 41) * (1 - THREE.MathUtils.smoothstep(time, 46, 49));
    this.look.lerp(this.transformerTarget, atTransformer);
    if (time >= 64 && time < 76) this.look.lerp(this.houseAt(0, 4, 0), 0.6 * THREE.MathUtils.smoothstep(time, 64, 66));
    if (time >= 75 && time < 79) this.look.lerp(this.window, THREE.MathUtils.smoothstep(time, 75, 76));
    if (time >= 80) {
      const socket = this.home.at(2.4, 1.45, -2.13);
      const laptop = this.home.at(1, 1.74, -1.06);
      this.look.lerp(time < 88 ? this.home.at(-0.2, 1.25, -1.9) : laptop, time < 88 ? 0.6 : THREE.MathUtils.smoothstep(time, 88, 91));
      if (time >= 88 && time < 90) this.look.lerp(socket, 1 - THREE.MathUtils.smoothstep(time, 88, 90));
    }
    if (this.ending === "ev" && this.endAt != null && time >= this.endAt) this.#playEv(dt);
    scene.rig.setRailPose(this.eye, this.look, (time >= 11 && time < 40) || time >= 80);
    this.home.group.visible = time >= 79;
    scene.world.group.visible = scene.nodes.root.visible = time < 79;
    scene.neighbour.visible = time < 79 && this.neighbourVisible;
    if (time >= 79) this.home.update(time);
    this.cable.material.depthTest = this.pulses.material.depthTest = time >= 80;
    for (const glow of this.glows) glow.material.depthTest = time >= 80;
    // The ring marks the home the power goes into, so only on the full journey (a screen
    // that ends at the streets, with endAt, never goes into a home).
    this.houseHalo.visible = this.endAt == null && time >= 64 && time < 78;
    this.group.visible = time < 78 || time >= 80;
    for (const branch of this.branches) {
      branch.mesh.visible = time >= 64 && time < 78;
      // (On the street-charger ending the homes' end glows step aside.)
      branch.glow.visible = branch.mesh.visible && !(this.endingTime > 0);
      branch.mesh.material.uniforms.uOn.value = 1;
      const progress = THREE.MathUtils.smoothstep(time, 64, 70);
      branch.mesh.material.uniforms.uFront.value = progress * branch.length;
      branch.mesh.material.uniforms.uTime.value = time;
      branch.curve.getPointAt(progress, branch.glow.position);
    }
    const cutaway = time < 9 ? 0 : time < 12 ? (time - 9) / 3 : time < 40 ? 1 : Math.max(0, 1 - (time - 40) / 3);
    scene.lookInside.u = cutaway;
    scene.lookInside.apply();
    scene.windViz = time < 11 ? 1 : 0;
    this.magnetRing.visible = this.coilGlow.visible = time >= 11 && time < 30;
    scene.nodes.generatorRotor.visible = !this.magnetRing.visible;
    for (const cover of this.generatorCover) cover.visible = !this.magnetRing.visible;
    this.magnetRing.rotation.x = scene.nodes.rotorSpin.rotation.x;
    for (let i = 0; i < this.coilGlow.count; i++) {
      const angle = i / this.coilGlow.count * Math.PI * 2;
      const glow = Math.pow(Math.max(0, Math.cos((angle - this.magnetRing.rotation.x) * 8)), 5);
      this.coilGlow.setColorAt(i, this.color.setRGB(glow, glow * 0.65, glow * 0.2));
    }
    this.coilGlow.instanceColor.needsUpdate = true;
    this.uniforms.uFront.value = front;
    this.uniforms.uTime.value = time;
    this.uniforms.uOn.value = time >= 11 ? 1 : 0;
    for (let i = 0; i < this.pulses.count; i++) {
      const distance = front - i * (time >= 80 ? 0.6 : 14);
      const visible = time >= 11 && distance >= (time >= 80 ? this.roomStartMetres : 0);
      this.energyCurve.getPointAt(Math.max(0, distance) / this.energyLength, this.point);
      const radius = visible ? THREE.MathUtils.clamp(this.point.distanceTo(this.eye) * 0.009, time >= 80 ? 0.015 : 0.15, time >= 80 ? 0.035 : 0.8) : 0;
      this.matrix.compose(this.point, this.rotation.identity(), this.scale.setScalar(radius));
      this.pulses.setMatrixAt(i, this.matrix);
      this.glows[i].position.copy(this.point);
      this.glows[i].visible = visible;
      this.glows[i].scale.setScalar(radius * 7);
    }
    this.pulses.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.glows[0].material.map.dispose();
    this.home.dispose();
  }
}
