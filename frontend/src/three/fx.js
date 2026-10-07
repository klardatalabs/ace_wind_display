// Weather you can see: rain that falls (slanted by the wind) around the camera, and faint
// streamlines of air flowing through the rotor. Both animate entirely on the GPU: each
// streak has a fixed random seed and its position is a function of time, wrapped inside a box.

import * as THREE from "three";

function seeds(count) {
  const a = new Float32Array(count * 2 * 3);
  const end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = Math.random(), y = Math.random(), z = Math.random();
    for (let k = 0; k < 2; k++) {
      a.set([x, y, z], (i * 2 + k) * 3);
      end[i * 2 + k] = k;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3)); // unused, needed for draw count
  g.setAttribute("seed", new THREE.BufferAttribute(a, 3));
  g.setAttribute("endpoint", new THREE.BufferAttribute(end, 1));
  return g;
}

// ---------------------------------------------------------------- rain

const RAIN_VERT = /* glsl */ `
attribute vec3 seed;
attribute float endpoint;
uniform float uTime;
uniform vec3 uCamera;
uniform vec3 uVelocity;
uniform float uBox;
varying float vAlpha;
void main() {
  vec3 q = mod(seed * uBox - uVelocity * uTime, uBox) - uBox * 0.5;
  float r = length(q.xz);
  vAlpha = (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, r)) * (0.35 + 0.65 * fract(seed.x * 91.7));
  vec3 p = uCamera + q - normalize(uVelocity) * (endpoint * 1.1);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const RAIN_FRAG = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
varying float vAlpha;
void main() { gl_FragColor = vec4(uColor, vAlpha * uOpacity); }`;

// ---------------------------------------------------------------- wind through the rotor

const WIND_VERT = /* glsl */ `
attribute vec3 seed;
attribute float endpoint;
uniform float uTime;
uniform float uSpeed;
uniform vec3 uBox;     // length along the wind, height, width
uniform vec3 uCentre;
varying float vAlpha;
void main() {
  float along = mod(seed.x * uBox.x - uSpeed * uTime, uBox.x);
  float len = 9.0;
  float tail = clamp(along + endpoint * len, 0.0, uBox.x);
  vec3 p;
  p.x = uCentre.x + uBox.x * 0.5 - tail;                 // air arrives from +x, the front of the nacelle
  p.y = uCentre.y + (seed.y - 0.5) * uBox.y;
  p.z = uCentre.z + (seed.z - 0.5) * uBox.z;
  // the flow bends round the rotor disc
  float nearDisc = exp(-pow((p.x - 4.6) / 22.0, 2.0));
  vec3 radial = vec3(0.0, p.y - uCentre.y, p.z - uCentre.z);
  p += normalize(radial + 0.001) * nearDisc * 5.0 * smoothstep(60.0, 20.0, length(radial));
  p.y += sin(p.x * 0.07 + uTime * 0.9 + seed.z * 30.0) * 1.3;
  vAlpha = sin(3.14159 * clamp(tail / uBox.x, 0.0, 1.0)) * (0.5 + 0.5 * fract(seed.y * 53.1));
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}`;

export function createWeatherFx() {
  const group = new THREE.Group();
  group.name = "WeatherFx";

  const RAIN_MAX = 4200;
  const rainGeo = seeds(RAIN_MAX);
  const rainUniforms = {
    uTime: { value: 0 },
    uCamera: { value: new THREE.Vector3() },
    uVelocity: { value: new THREE.Vector3(2, -24, 1) },
    uBox: { value: 64 },
    uOpacity: { value: 0 },
    uColor: { value: new THREE.Color(0xc6d3de) },
  };
  const rain = new THREE.LineSegments(rainGeo, new THREE.ShaderMaterial({ uniforms: rainUniforms, vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false }));
  rain.frustumCulled = false;
  rain.visible = false;
  group.add(rain);

  const WIND_COUNT = 520;
  const windUniforms = {
    uTime: { value: 0 },
    uSpeed: { value: 12 },
    uBox: { value: new THREE.Vector3(260, 150, 190) },
    uCentre: { value: new THREE.Vector3(60, 3, 0) },
    uOpacity: { value: 0 },
  };
  const windMat = new THREE.ShaderMaterial({
    uniforms: windUniforms,
    vertexShader: WIND_VERT,
    fragmentShader: /* glsl */ `varying float vAlpha; uniform float uOpacity; void main(){ gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * uOpacity); }`,
    transparent: true,
    depthWrite: false,
  });
  const wind = new THREE.LineSegments(seeds(WIND_COUNT), windMat);
  wind.frustumCulled = false;
  wind.visible = false;
  wind.name = "WindStreamlines";
  wind.userData.noPick = true;
  rain.userData.noPick = true;
  // lives in the nacelle's frame (added to nodes.yaw by the scene) so it always faces the wind

  const fade = { rain: 0, wind: 0 };
  /**
   * @param {object} p
   * @param {number} p.time
   * @param {THREE.Camera} p.camera
   * @param {number} p.rain     0..1
   * @param {number} p.windMs
   * @param {THREE.Vector2} p.windVec  unit vector the air moves toward (x east, y south)
   * @param {number} p.windViz  0..1 how much of the streamline overlay to show
   * @param {number} p.dt
   */
  const update = ({ time, camera, rain: rainAmount, windMs, windVec, windViz, dt }) => {
    // ease so effects fade in and out instead of popping
    fade.rain += (rainAmount - fade.rain) * Math.min(1, dt * 1.2);
    fade.wind += (windViz - fade.wind) * Math.min(1, dt * 1.6);

    rain.visible = fade.rain > 0.02;
    if (rain.visible) {
      rainUniforms.uTime.value = time;
      rainUniforms.uCamera.value.copy(camera.position);
      rainUniforms.uVelocity.value.set(windVec.x * windMs * 0.45, -22 - 8 * fade.rain, windVec.y * windMs * 0.45);
      rainUniforms.uOpacity.value = 0.55 * fade.rain;
      rainGeo.setDrawRange(0, Math.floor(RAIN_MAX * (0.25 + 0.75 * fade.rain)) * 2);
    }

    wind.visible = fade.wind > 0.02;
    if (wind.visible) {
      windUniforms.uTime.value = time;
      windUniforms.uSpeed.value = 4 + windMs * 2.2;
      windUniforms.uOpacity.value = 0.42 * fade.wind;
    }
  };

  return { group, wind, update };
}
