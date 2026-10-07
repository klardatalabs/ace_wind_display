// "Look inside": one progress value U (0 → 1) drives four effects at once.
//   1. Section cutaway — a clipping plane sweeps through the front shell; cut faces are
//      filled with a bright cap colour so the section reads as solid, not hollow.
//   2. Exploded / peel — front halves slide outward along local z:  front.position.z = 3.5 * U
//   3. Ghost / X-ray   — shell opacity = 1 - 0.92 * U, depthWrite off once it starts fading
//   4. Camera fly-in   — handled by CameraRig, started alongside by TurbineScene

import * as THREE from "three";
import gsap from "gsap";
import { MOSS } from "./themes.js";

const PEEL_DISTANCE = 3.5;

function injectCap(material, uniforms) {
  material.side = THREE.DoubleSide;
  material.transparent = true;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCapColor = uniforms.color;
    shader.uniforms.uCapAlpha = uniforms.alpha;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uCapColor;\nuniform float uCapAlpha;")
      .replace(
        "#include <opaque_fragment>",
        "#include <opaque_fragment>\nif (!gl_FrontFacing && uCapAlpha > 0.0) { gl_FragColor = vec4(uCapColor, max(gl_FragColor.a, uCapAlpha)); }"
      );
  };
  material.customProgramCacheKey = () => "ww-cap";
}

export class LookInside {
  /**
   * @param {{ front: THREE.Mesh[], back: THREE.Mesh[] }[]} shells  split tower + nacelle
   * @param {(u: number) => void} [onChange]
   */
  constructor(shells, onChange) {
    this.u = 0;
    this.onChange = onChange;
    this.capUniforms = { color: { value: new THREE.Color(MOSS[200]) }, alpha: { value: 0 } };
    this.items = [];

    for (const shell of shells) {
      for (const half of ["front", "back"]) {
        for (const mesh of shell[half]) {
          const material = mesh.material.clone();
          mesh.material = material;
          injectCap(material, this.capUniforms);
          const item = {
            mesh,
            half,
            material,
            baseOpacity: material.opacity,
            baseZ: mesh.position.z,
            plane: half === "front" ? new THREE.Plane() : null,
            extras: [], // outlines / edges that should fade with the shell
          };
          if (item.plane) material.clippingPlanes = [item.plane];
          mesh.traverse((child) => {
            if (child !== mesh && (child.userData.isOutline || child.userData.isEdges)) {
              child.material = child.material.clone();
              if (item.plane) child.material.clippingPlanes = [item.plane];
              item.extras.push({ material: child.material, baseOpacity: child.material.opacity });
            }
          });
          this.items.push(item);
        }
      }
    }
    this.apply();
  }

  /** Re-reads shell materials after a theme change. */
  rebind() {
    for (const item of this.items) {
      const material = item.mesh.material;
      if (material !== item.material) {
        item.material = material;
        item.baseOpacity = material.opacity;
        injectCap(material, this.capUniforms);
        if (item.plane) material.clippingPlanes = [item.plane];
      }
    }
    this.apply();
  }

  apply() {
    const u = this.u;
    const ghost = 1 - 0.92 * u;
    this.capUniforms.alpha.value = u > 0.02 ? 0.55 * Math.min(1, u * 1.6) : 0;
    for (const item of this.items) {
      if (item.half === "front") item.mesh.position.z = item.baseZ + PEEL_DISTANCE * u;
      item.material.opacity = item.baseOpacity * ghost;
      item.material.depthWrite = u < 0.02;
      for (const e of item.extras) e.material.opacity = e.baseOpacity * ghost;
    }
    this.onChange?.(u);
  }

  /** Called every frame: keeps each cutting plane attached to its (moving) shell half. */
  updatePlanes() {
    const keepBelow = THREE.MathUtils.lerp(3.6, 0.9, this.u); // local z the cut has swept down to
    for (const item of this.items) {
      if (!item.plane) continue;
      item.mesh.updateWorldMatrix(true, false);
      item.plane.set(new THREE.Vector3(0, 0, -1), keepBelow).applyMatrix4(item.mesh.matrixWorld);
    }
  }

  to(target, duration = 2.4) {
    gsap.killTweensOf(this);
    return gsap.to(this, { u: target, duration, ease: "power2.inOut", onUpdate: () => this.apply() });
  }

  open(duration) {
    return this.to(1, duration);
  }

  close(duration) {
    return this.to(0, duration);
  }
}
