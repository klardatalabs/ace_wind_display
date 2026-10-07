// The sky dome: a gradient driven by the real sun, a sun disc and glow, drifting clouds
// (more of them when the weather says so, carried along by the wind), and stars at night.
// Colours come from environment.skyState(), so the sky always matches the light on the ground.

import * as THREE from "three";
import { GLSL_NOISE } from "./world/noise.js";

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunStrength;
uniform float uNight;
uniform float uCloud;
uniform vec3 uCloudLight;
uniform vec3 uCloudDark;
uniform vec2 uDrift;
uniform float uTime;
varying vec3 vDir;
${GLSL_NOISE}

void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);

  vec3 col = mix(uHorizon, uZenith, pow(h, 0.42));

  // sun: a warm halo and a hard disc
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 5.0) * 0.1 + pow(sd, 48.0) * 0.28) * uSunStrength;
  col += uSunColor * smoothstep(0.99955, 0.99985, sd) * 6.0 * uSunStrength;

  // stars, fading out as the sky brightens or clouds cover them
  if (uNight > 0.02 && d.y > 0.0) {
    vec3 q = floor(d * 260.0);
    float star = step(0.9982, wwHash(q.xy + q.z * 17.0));
    col += vec3(star) * (0.5 + 0.5 * wwHash(q.yz)) * uNight * smoothstep(0.0, 0.25, d.y) * (1.0 - uCloud);
  }

  // clouds on a flat layer, moved by the wind
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.12) * 0.75 + uDrift * uTime;
    float n = wwFbm(uv);
    float detail = wwFbm(uv * 3.1 + 7.0);
    float thresh = mix(0.78, 0.3, uCloud);
    float dens = smoothstep(thresh, thresh + 0.2, n * 0.8 + detail * 0.25);
    dens *= smoothstep(0.0, 0.16, d.y);
    float lit = clamp(0.55 + 0.9 * (n - 0.5) + 0.35 * sd, 0.0, 1.0);
    vec3 cc = mix(uCloudDark, uCloudLight, lit);
    cc += uSunColor * pow(sd, 8.0) * 0.45 * uSunStrength; // silver lining toward the sun
    col = mix(col, cc, dens * (0.55 + 0.4 * uCloud));
  }

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function createSky(radius = 4000) {
  const uniforms = {
    uZenith: { value: new THREE.Color(0x3b82d8) },
    uHorizon: { value: new THREE.Color(0xb4d6f2) },
    uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2).normalize() },
    uSunColor: { value: new THREE.Color(0xfff3de) },
    uSunStrength: { value: 1 },
    uNight: { value: 0 },
    uCloud: { value: 0.3 },
    uCloudLight: { value: new THREE.Color(0xffffff) },
    uCloudDark: { value: new THREE.Color(0xaab4bf) },
    uDrift: { value: new THREE.Vector2(0.004, 0.002) },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, fog: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), material);
  sky.name = "Sky";
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  sky.raycast = () => {};
  sky.userData.uniforms = uniforms;

  /** Applies a skyState() result. */
  sky.userData.apply = (state, sunDir, windDir = new THREE.Vector2(1, 0.3)) => {
    uniforms.uZenith.value.copy(state.zenith);
    uniforms.uHorizon.value.copy(state.horizon);
    uniforms.uSunDir.value.copy(sunDir);
    uniforms.uSunColor.value.copy(state.sunColor);
    uniforms.uSunStrength.value = state.sunStrength;
    uniforms.uNight.value = state.night;
    uniforms.uCloud.value = state.cloudCover;
    uniforms.uCloudLight.value.copy(state.cloudLight);
    uniforms.uCloudDark.value.copy(state.cloudDark);
    uniforms.uDrift.value.copy(windDir).multiplyScalar(state.cloudDrift);
  };
  return sky;
}
