import * as THREE from "three";
import { chapterAt, chapterStart, railProgress, STORY_SECONDS } from "./storyTimeline.ts";

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

/** Opt-in cinematic director. Existing screen shots and geometry are left alone. */
export class StoryRail {
  constructor(scene, interiors) {
    this.scene = scene;
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
    scene.rig.returnAfter = 3;
    this.group = new THREE.Group();
    this.group.name = "StoryEnergy";
    scene.scene.add(this.group);
    scene.shown.yaw = scene.live.yaw;
    scene.nodes.yaw.rotation.y = scene.shown.yaw;
    scene.towerPivot.rotation.y = scene.shown.yaw;
    this.buildPaths();
    this.buildGenerator();
    this.update(0);
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
    this.railTimes = [0, 11, 23, 30, 40, 46, 50, 64];
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
    this.energyCurve = new THREE.CurvePath();
    const cumulative = [0];
    for (let i = 1; i < route.length; i++) {
      this.energyCurve.add(new THREE.LineCurve3(route[i - 1], route[i]));
      cumulative.push(cumulative[i - 1] + route[i].distanceTo(route[i - 1]));
    }
    this.energyLength = cumulative[cumulative.length - 1];
    this.energyDistances = markers.map((index) => cumulative[index] / this.energyLength);
    this.route = route;
    this.baseRoute = route.map((point) => point.clone());
    this.towerEnd = markers[4];
    this.uniforms = { uFront: { value: 0 }, uLength: { value: this.energyLength }, uTime: { value: 0 }, uOn: { value: 0 }, uYaw: { value: 0 }, uTowerEnd: { value: cumulative[this.towerEnd] } };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      vertexShader: "varying float distanceAlong; uniform float uLength; uniform float uYaw; uniform float uTowerEnd; void main(){ distanceAlong=uv.x*uLength; float angle=uYaw*(1.0-smoothstep(uTowerEnd,uTowerEnd+6.0,distanceAlong)); vec3 p=position; p.x=position.x*cos(angle)+position.z*sin(angle); p.z=-position.x*sin(angle)+position.z*cos(angle); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }",
      fragmentShader: "varying float distanceAlong; uniform float uFront; uniform float uTime; uniform float uOn; void main(){ float reached=1.0-smoothstep(uFront-0.8,uFront+0.8,distanceAlong); float pulse=pow(max(0.0,cos((distanceAlong-uTime*12.0)*0.5)),16.0); gl_FragColor=vec4(mix(vec3(0.12,0.65,0.37),vec3(0.7,1.0,0.85),pulse), reached*(0.22+0.78*pulse)*uOn); }",
    });
    this.cable = new THREE.Mesh(new THREE.TubeGeometry(this.energyCurve, 900, 0.24, 6, false), material);
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
    return { ...beat, seconds: this.time, fade, camera: this.scene.camera.position.toArray(), rail: this.eye.toArray(), userOffset: { ...this.scene.rig.user }, energyMetres: this.uniforms.uFront.value, lead: lead.toArray(), leadNdc: lead.clone().project(this.scene.camera).toArray(), fps: this.fps, magnetAngle: this.magnetRing.rotation.x };
  }

  update(dt) {
    if (dt > 0) {
      this.frameCount++;
      this.frameSeconds += dt;
      if (this.frameSeconds >= 2) {
        this.fps = this.frameCount / this.frameSeconds;
        this.frameSeconds = this.frameCount = 0;
      }
    }
    if (!this.frozen) this.time = (this.time + dt) % STORY_SECONDS;
    const time = this.time;
    const scene = this.scene;
    if (Math.abs(scene.shown.yaw - this.lastYaw) > 0.001) {
      const delta = scene.shown.yaw - this.baseYaw;
      for (let i = 0; i <= 13; i++) this.cameraCurve.points[i].copy(this.baseCameraPoints[i]).applyAxisAngle(up, delta);
      this.cameraCurve.updateArcLengths();
      for (let i = 0; i <= this.towerEnd; i++) this.route[i].copy(this.baseRoute[i]).applyAxisAngle(up, delta);
      this.energyCurve.cacheLengths = null;
      this.uniforms.uYaw.value = delta;
      this.lastYaw = scene.shown.yaw;
    }
    const cameraU = railProgress(time, this.cameraDistances, this.railTimes);
    this.cameraCurve.getPointAt(cameraU, this.eye);
    const front = railProgress(time, this.energyDistances, this.railTimes) * this.energyLength;
    const lookAhead = time >= 23 && time < 40 ? 0.8 : 5;
    this.energyCurve.getPointAt(Math.max(0, Math.min(1, (front + lookAhead) / this.energyLength)), this.look);
    scene.nodes.yaw.localToWorld(this.point.set(time < 11 ? 4.6 : 2.35, 3, 0));
    this.look.lerp(this.point, 1 - THREE.MathUtils.smoothstep(time, 21, 25));
    const atTransformer = THREE.MathUtils.smoothstep(time, 39, 41) * (1 - THREE.MathUtils.smoothstep(time, 46, 49));
    this.look.lerp(this.transformerTarget, atTransformer);
    scene.rig.setRailPose(this.eye, this.look, time >= 11 && time < 40);
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
      const distance = front - i * 14;
      const visible = time >= 11 && distance >= 0;
      this.energyCurve.getPointAt(Math.max(0, distance) / this.energyLength, this.point);
      const radius = visible ? THREE.MathUtils.clamp(this.point.distanceTo(this.eye) * 0.009, 0.15, 0.8) : 0;
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
  }
}
