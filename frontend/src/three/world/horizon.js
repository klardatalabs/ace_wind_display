// The far distance: layers of hazy hills (the Mendips, the Welsh hills across the estuary)
// and the Second Severn Crossing on the horizon. Drawn unlit and tinted by the sky so they
// dissolve into the haze the way real distant hills do, whatever the time of day.

import * as THREE from "three";
import { fbm } from "./noise.js";

const VERT = /* glsl */ `
varying float vH;
void main() {
  vH = position.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform float uDay;
uniform float uTone;   // 0 = very light & hazy, 1 = darker nearer ridge
uniform float uTop;
varying float vH;
void main() {
  float t = clamp(vH / uTop, 0.0, 1.0);
  vec3 hill = mix(uHorizon, uZenith, 0.28) * mix(0.9, 0.62, uTone) * (0.35 + 0.65 * uDay);
  // haze thickens toward the foot of the hill
  vec3 col = mix(uHorizon, hill, smoothstep(0.0, 0.7, t) * 0.8 + 0.2 * uTone);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

function ridge({ radius, base, amp, seed, segments = 360, tone, bias }) {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    // taller to the west (Wales) and the south-east (Mendips), lower to the north
    const bump = Math.max(0, bias(a));
    const h = base + amp * (0.35 + bump) * (0.4 + fbm(ca * 3.2 + seed, sa * 3.2 + seed * 1.3, 4) * 1.2);
    positions.push(ca * radius, -40, sa * radius, ca * radius, h, sa * radius);
    if (i < segments) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const uniforms = {
    uHorizon: { value: new THREE.Color() },
    uZenith: { value: new THREE.Color() },
    uDay: { value: 1 },
    uTone: { value: tone },
    uTop: { value: base + amp * 1.6 },
  };
  const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, fog: false, depthWrite: false }));
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  mesh.userData.world = true;
  return { mesh, uniforms };
}

export function buildHorizon() {
  const group = new THREE.Group();
  group.name = "Horizon";
  const layers = [
    ridge({ radius: 8400, base: 50, amp: 250, seed: 1.7, tone: 0.0, bias: (a) => Math.cos(a - Math.PI) * 0.9 + Math.cos(a - 0.7) * 0.4 }), // far
    ridge({ radius: 7000, base: 25, amp: 140, seed: 5.2, tone: 0.5, bias: (a) => Math.cos(a - Math.PI * 0.9) * 0.8 + Math.cos(a - 0.8) * 0.5 }), // nearer
  ];
  for (const l of layers) group.add(l.mesh);

  // the Second Severn Crossing: a long low deck on piers with two cable-stayed pylons
  const bridgeUniforms = { uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() }, uDay: { value: 1 }, uTone: { value: 1 }, uTop: { value: 1 } };
  const bridgeMat = new THREE.ShaderMaterial({ uniforms: bridgeUniforms, vertexShader: VERT, fragmentShader: FRAG.replace("float t = clamp(vH / uTop, 0.0, 1.0);", "float t = 1.0;"), fog: false });
  const deck = new THREE.BoxGeometry(2600, 3, 10);
  const bridge = new THREE.Group();
  const deckMesh = new THREE.Mesh(deck, bridgeMat);
  deckMesh.position.y = 14;
  bridge.add(deckMesh);
  for (const x of [-200, 200]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(7, 70, 7), bridgeMat);
    tower.position.set(x, 35, 0);
    bridge.add(tower);
    for (const side of [-1, 1]) {
      const stay = new THREE.Mesh(new THREE.BoxGeometry(260, 0.8, 0.8), bridgeMat);
      stay.position.set(x + side * 130, 40, 0);
      stay.rotation.z = side * -0.2;
      bridge.add(stay);
    }
  }
  // north-west of the turbine, 7 km out across the estuary
  bridge.position.set(-5600, 0, -3000);
  bridge.rotation.y = 0.12;
  bridge.userData.world = true;
  group.add(bridge);

  const all = [...layers.map((l) => l.uniforms), bridgeUniforms];
  const update = (sky) => {
    for (const u of all) {
      u.uHorizon.value.copy(sky.horizon);
      u.uZenith.value.copy(sky.zenith);
      u.uDay.value = sky.day;
    }
  };
  group.userData.world = true;
  return { group, update };
}
