// The Severn Estuary: deep teal water that mirrors the real sky (clouds, sun glitter,
// golden hour), ripples and sparkles with the wind, and foams where it meets the shore.
// (The real estuary is silty, but a muddy grey reads as concrete on a screen.)

import * as THREE from "three";
import { GLSL_NOISE } from "./noise.js";

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
}`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunStrength;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uCloud;
uniform float uRough;
uniform float uDay;
varying vec3 vWorld;
${GLSL_NOISE}
#include <common>

float ripple(vec2 p) {
  return wwNoise(p * 0.22 + vec2(uTime * 0.25, uTime * 0.15)) * 0.65 + wwNoise(p * 0.6 - vec2(uTime * 0.35, -uTime * 0.2)) * 0.35;
}

void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec2 p = vWorld.xz;
  float e = 0.35;
  float h0 = ripple(p);
  float hx = ripple(p + vec2(e, 0.0));
  float hz = ripple(p + vec2(0.0, e));
  float dist = distance(cameraPosition, vWorld);
  float amp = (0.35 + 1.4 * uRough) * (1.0 - smoothstep(120.0, 900.0, dist) * 0.95);
  vec3 N = normalize(vec3(-(hx - h0) / e * amp, 1.0, -(hz - h0) / e * amp));

  float fres = 0.04 + 0.6 * pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 R = reflect(-V, N);
  float ry = max(R.y, 0.0);
  vec3 sky = mix(uHorizon, uZenith, pow(ry, 0.5));
  sky = mix(sky, vec3(dot(sky, vec3(0.333))) * vec3(1.02, 1.04, 1.07), uCloud * 0.2);
  float sd = max(dot(R, uSunDir), 0.0);
  vec3 glint = uSunColor * (pow(sd, 300.0) * 2.2 + pow(sd, 40.0) * 0.22) * uSunStrength * (1.0 - smoothstep(400.0, 3500.0, dist) * 0.6);

  // the water itself: deep teal, greener over the shallows, lit by the day
  vec3 body = mix(vec3(0.04, 0.16, 0.21), vec3(0.08, 0.25, 0.25), wwFbm(p * 0.0035 + wwFbm(p * 0.0012) * 2.0));
  body *= 0.3 + 0.9 * uDay;
  vec3 col = mix(body, sky * 0.85, fres) + glint;
  // small sparkles on the ripple crests, close to the camera
  col += vec3(0.55, 0.72, 0.78) * smoothstep(0.74, 0.95, h0) * 0.09 * uDay * (1.0 - smoothstep(200.0, 1500.0, dist));

  // foam where the water meets the shore, and slow lines of swell
  float d = p.x - wwShoreX(p.y);
  float foamLine = smoothstep(0.55, 0.95, wwNoise(vec2(d * 0.35 - uTime * 0.35, p.y * 0.05)))
                 * (1.0 - smoothstep(3.0, 12.0, d)) * smoothstep(-26.0, -2.0, d);
  col = mix(col, vec3(0.9) * (0.35 + 0.65 * uDay), foamLine * 0.55);

  // the estuary fades into the haze over kilometres, not hundreds of metres like the land
  float haze = smoothstep(1200.0, 9000.0, dist);
  col = mix(col, uHorizon * 0.93, haze * 0.7);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function buildWater() {
  const uniforms = THREE.UniformsUtils.merge([
    {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uSunStrength: { value: 1 },
      uZenith: { value: new THREE.Color(0x3b82d8) },
      uHorizon: { value: new THREE.Color(0xb4d6f2) },
      uCloud: { value: 0.3 },
      uRough: { value: 0.2 },
      uDay: { value: 1 },
    },
  ]);
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(9500, 96), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.38;
  mesh.name = "Water";
  mesh.userData.world = true;
  mesh.userData.hotspot = "estuary";
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
