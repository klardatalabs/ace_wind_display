// Splits a closed shell mesh into a front half (local z > 0) and back half, once, at load.
// That's what lets the "exploded view" slide the front half away without cutting the
// model in Blender. Triangles are assigned by their centroid, so the seam follows the mesh.

import * as THREE from "three";

function splitGeometry(geometry, axis = "z") {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const pos = geo.attributes.position;
  const front = [];
  const back = [];
  const a = { x: 0, y: 1, z: 2 }[axis];
  for (let tri = 0; tri < pos.count / 3; tri++) {
    let c = 0;
    for (let v = 0; v < 3; v++) c += pos.array[(tri * 3 + v) * 3 + a];
    (c / 3 >= 0 ? front : back).push(tri);
  }
  const build = (tris) => {
    const g = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(geo.attributes)) {
      const size = attr.itemSize;
      const src = attr.array;
      const dst = new src.constructor(tris.length * 3 * size);
      tris.forEach((tri, i) => dst.set(src.subarray(tri * 3 * size, (tri + 1) * 3 * size), i * 3 * size));
      g.setAttribute(name, new THREE.BufferAttribute(dst, size, attr.normalized));
    }
    g.computeBoundingSphere();
    return g;
  };
  geo.dispose();
  return { front: build(front), back: build(back) };
}

/**
 * Replaces every mesh under `node` with front/back halves.
 * @returns {{ front: THREE.Mesh[], back: THREE.Mesh[] }}
 */
export function splitShell(node, axis = "z") {
  const result = { front: [], back: [] };
  const meshes = [];
  node.traverse((o) => o.isMesh && meshes.push(o));
  for (const mesh of meshes) {
    const { front, back } = splitGeometry(mesh.geometry, axis);
    for (const [half, geometry] of [["front", front], ["back", back]]) {
      const m = new THREE.Mesh(geometry, mesh.material);
      m.name = `${mesh.name || node.name}_${half}`;
      m.position.copy(mesh.position);
      m.quaternion.copy(mesh.quaternion);
      m.scale.copy(mesh.scale);
      m.castShadow = mesh.castShadow;
      m.receiveShadow = mesh.receiveShadow;
      m.userData = { ...mesh.userData, shellHalf: half };
      mesh.parent.add(m);
      result[half].push(m);
    }
    mesh.parent.remove(mesh);
    mesh.geometry.dispose();
  }
  return result;
}
