// Three looks, all in natural colour:
//   cartoon   — students: bright, friendly toon shading with ink outlines
//   realistic — community: PBR materials in the real light of the hour, the Lawrence Weston scan around it
//   blueprint — college: classic engineering drawing, cyan lines on deep navy
// The turbine itself is always white with Enercon-green tower bands, as in real life.

import * as THREE from "three";

// Accent greens (the Enercon band colour), kept for UI-adjacent 3D bits.
export const MOSS = {
  25: 0xf7fafc, 50: 0xeef4f9, 100: 0xdde9f2, 200: 0xbfd6e8, 300: 0x6fbf93, 400: 0x3f9f6f,
  500: 0x23855a, 600: 0x186b47, 700: 0x13553a, 800: 0x1b3342, 900: 0x11222e, 950: 0x0a151d, white: 0xffffff,
};

// Blueprint drawing colours.
export const BLUEPRINT = { paper: 0x071a33, paperLight: 0x0d2b52, line: 0x9fd8ff, lineDim: 0x4fb3ff, solid: 0x1b4a7a, fill: 0x2f78b8 };

// glTF material name -> colour role
const ROLE_BY_MATERIAL = {
  M_Turbine_White: "body",
  M_Enercon_Green_1: "band1",
  M_Enercon_Green_2: "band2",
  M_Enercon_Green_3: "band3",
  M_Enercon_Green_4: "band4",
  M_Enercon_Green_5: "band5",
  M_Concrete: "ground",
  M_Steel_Bare: "metal",
  M_Steel_Painted: "metal",
  M_Door: "dark",
  M_Transformer_Green: "dark",
  M_Aviation_Light: "light",
  M_Copper: "copper",
  M_Cabinet: "cabinet",
};

const PALETTES = {
  cartoon: {
    body: 0xffffff, band1: 0x0e5a34, band2: 0x147a46, band3: 0x1f9a58, band4: 0x4bb872, band5: 0x8fd49b,
    ground: 0xd3d8dc, metal: 0xc3ccd3, dark: 0x4a545c, light: 0xff6b5a, copper: 0xe08a3a, cabinet: 0xe8eef2,
    accent: 0xf5b82e, cable: 0x2a3138,
    lamp: 0xfff1c9,
    grass: 0x84d35f, tree: 0x3fae4d, trunk: 0x8a5a34, house: 0xfff1de, roof: 0xd8604a, water: 0x5bbbea, road: 0xa4adb4,
  },
  realistic: {
    body: 0xf0f2f1, band1: 0x0c3a1f, band2: 0x14512c, band3: 0x1f6b3c, band4: 0x3b8a52, band5: 0x6aa877,
    ground: 0xb4b8b5, metal: 0x9aa3a8, dark: 0x2d353b, light: 0xff2d20, copper: 0xc47a35, cabinet: 0xc9d0d4,
    accent: 0xe6a824, cable: 0x1c2126,
    lamp: 0xfff1c9,
    grass: 0x76904a, tree: 0x3e6b34, trunk: 0x4a3b2e, house: 0xd9c9b0, roof: 0x6e4a42, water: 0x7d8b8f, road: 0x4d5155,
  },
  blueprint: {
    body: BLUEPRINT.solid, band1: BLUEPRINT.solid, band2: BLUEPRINT.solid, band3: BLUEPRINT.solid, band4: BLUEPRINT.solid, band5: BLUEPRINT.solid,
    ground: BLUEPRINT.paperLight, metal: 0x7fc4f5, dark: BLUEPRINT.solid, light: 0xffffff, copper: 0xffc46b, cabinet: 0x7fc4f5,
    accent: 0xffd36b, cable: 0x9fd8ff,
    lamp: 0xffffff,
    grass: BLUEPRINT.paper, tree: 0x1f5c91, trunk: 0x1b4a7a, house: 0x2a6aa6, roof: 0x3f86c7, water: 0x0a2a52, road: 0x123a69,
  },
};

// Landscape parts are lit but never translucent, outlined or edged.
const LANDSCAPE_ROLES = new Set(["grass", "tree", "trunk", "house", "roof", "water", "road"]);
export const isLandscapeRole = (role) => LANDSCAPE_ROLES.has(role);

// Colour of the faces revealed when the shell is cut open.
export const CAP_COLORS = { cartoon: 0xf7b267, realistic: 0xe9b872, blueprint: 0x7fd6ff };

/** Fallback sky for themes without a live environment (the blueprint look is a fixed drawing). */
export const ENVIRONMENTS = {
  cartoon: { skyTop: 0x4aa8f0, skyBottom: 0xd6efff, fog: 0xd6efff, fogNear: 260, fogFar: 1100, exposure: 1.05 },
  realistic: { skyTop: 0x5a95d6, skyBottom: 0xcfe0ee, fog: 0xcfdbe4, fogNear: 400, fogFar: 2800, exposure: 1.0 },
  blueprint: { skyTop: BLUEPRINT.paper, skyBottom: BLUEPRINT.paperLight, fog: BLUEPRINT.paper, fogNear: 200, fogFar: 900, exposure: 1.0 },
};

let toonGradient = null;
function toonRamp() {
  if (toonGradient) return toonGradient;
  const data = new Uint8Array([90, 170, 255]);
  toonGradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  toonGradient.minFilter = toonGradient.magFilter = THREE.NearestFilter;
  toonGradient.needsUpdate = true;
  return toonGradient;
}

/** Colour role for a mesh: interiors set userData.part, model meshes use their glTF material. */
export function roleOf(mesh) {
  return mesh.userData.part || ROLE_BY_MATERIAL[mesh.userData.materialName] || "body";
}

export function createMaterial(theme, role) {
  const color = PALETTES[theme][role] ?? PALETTES[theme].body;
  if (theme === "cartoon") {
    const mat = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp() });
    if (role === "light") mat.emissive = new THREE.Color(0xff3b30);
    return mat;
  }
  if (theme === "blueprint" && isLandscapeRole(role)) {
    return new THREE.MeshBasicMaterial({ color, transparent: role !== "grass", opacity: role === "grass" ? 1 : 0.5 });
  }
  if (theme === "blueprint") {
    const interior = ["accent", "copper", "cabinet", "metal", "cable"].includes(role);
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: interior ? 0.55 : 0.22, depthWrite: interior });
  }
  if (role === "water") return new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.3 });
  if (role === "lamp") return new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(0xffe2a8), emissiveIntensity: 2.4, roughness: 0.4 });
  const metallic = ["metal", "copper", "accent"].includes(role);
  return new THREE.MeshStandardMaterial({
    color,
    roughness: role === "body" ? 0.42 : metallic ? 0.35 : 0.8,
    metalness: metallic ? 0.65 : 0.05,
    emissive: role === "light" ? new THREE.Color(0xff2d20) : new THREE.Color(0x000000),
    emissiveIntensity: role === "light" ? 1.5 : 0,
  });
}

/** Ink outline (inverted hull, constant width on screen) for the cartoon look. */
export function addOutline(mesh, thickness = 0.0035) {
  const outline = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color: 0x14202b, side: THREE.BackSide, transparent: true })
  );
  outline.name = `${mesh.name}_outline`;
  outline.userData.isOutline = true;
  outline.castShadow = false;
  outline.raycast = () => {};
  outline.material.onBeforeCompile = (shader) => {
    shader.uniforms.uThickness = { value: thickness };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uThickness;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 clipNormal = projectionMatrix * modelViewMatrix * vec4(normal, 0.0);
        gl_Position.xy += normalize(clipNormal.xy + 1e-5) * uThickness * gl_Position.w;`
      );
  };
  mesh.add(outline);
  return outline;
}

/** Glowing edge lines for the blueprint look. */
export function addEdges(mesh, color = BLUEPRINT.line, opacity = 0.9) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 28),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  edges.name = `${mesh.name}_edges`;
  edges.userData.isEdges = true;
  edges.raycast = () => {};
  mesh.add(edges);
  return edges;
}
