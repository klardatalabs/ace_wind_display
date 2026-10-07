// Painted accents that make the turbine read better at hoarding scale: green tip stripes
// on the blades, a band round the spinner, and a blinking aviation light.
// Bands are drawn in the shader from the mesh's own (quantised, -1..1) coordinates, so
// they survive theme changes without extra geometry.

import * as THREE from "three";
import { MOSS } from "./themes.js";

export const BAND_COLORS = { cartoon: MOSS[500], realistic: 0x1f6b3c, blueprint: MOSS[200] };

const AXES = { x: 0, y: 1, z: 2 };

/** Marks a mesh so applyBands() stripes it. ranges: [[from, to], ...] in local -1..1 units. */
export function markBands(object, axis, ranges) {
  object.traverse((o) => {
    if (o.isMesh) o.userData.bands = { axis, ranges };
  });
}

export function applyBands(mesh, theme) {
  const spec = mesh.userData.bands;
  if (!spec || !mesh.material) return;
  const material = mesh.material;
  const color = new THREE.Color(BAND_COLORS[theme]);
  const inBand = spec.ranges.map(([a, b]) => `(step(${a.toFixed(3)}, v) - step(${b.toFixed(3)}, v))`).join(" + ");
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBandColor = { value: color };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vBandCoord;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvBandCoord = position[${AXES[spec.axis]}];`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vBandCoord;\nuniform vec3 uBandColor;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>\n{ float v = vBandCoord; diffuseColor.rgb = mix(diffuseColor.rgb, uBandColor, clamp(${inBand}, 0.0, 1.0)); }`
      );
  };
  material.customProgramCacheKey = () => `ww-bands-${spec.axis}-${spec.ranges.join("_")}`;
  material.needsUpdate = true;
}

/** Blinks the aviation light's glow (about once a second, like the real one). */
export function blinkAviationLight(meshes, time, theme) {
  const on = (time % 1.5) < 0.6;
  for (const m of meshes) {
    const mat = m.material;
    if (!mat?.emissive) continue;
    mat.emissiveIntensity = on ? (theme === "realistic" ? 2.4 : 1.2) : 0.15;
  }
}
