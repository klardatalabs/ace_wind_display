// Gradient sky dome: one big inside-out sphere, coloured from horizon to zenith.
// Cheaper and calmer than an HDRI, and it can be recoloured per theme.

import * as THREE from "three";

export function createSky(radius = 4000) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color() },
      bottomColor: { value: new THREE.Color() },
      offset: { value: 40 },
      exponent: { value: 0.55 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material);
  sky.name = "Sky";
  sky.renderOrder = -1;
  sky.raycast = () => {};

  sky.userData.setColors = (top, bottom) => {
    material.uniforms.topColor.value.set(top);
    material.uniforms.bottomColor.value.set(bottom);
  };
  return sky;
}
