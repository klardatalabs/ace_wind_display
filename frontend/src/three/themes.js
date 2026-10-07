// Three looks, one hue:
//   cartoon   — students: toon shading, ink outlines, bright mint sky
//   realistic — community: PBR materials, soft sun, the Lawrence Weston scan around it
//   blueprint — college: dark engineering view, glowing edges over translucent solids

import * as THREE from "three";

export const MOSS = {
  25: 0xf6fbf8, 50: 0xeaf6ef, 100: 0xd3ecdd, 200: 0xa9d9bd, 300: 0x77c09a, 400: 0x46a374,
  500: 0x23855a, 600: 0x186b47, 700: 0x13553a, 800: 0x0f432e, 900: 0x0b3223, 950: 0x06211a, white: 0xffffff,
};

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
    body: MOSS.white, band1: MOSS[700], band2: MOSS[600], band3: MOSS[500], band4: MOSS[400], band5: MOSS[300],
    ground: MOSS[200], metal: MOSS[100], dark: MOSS[700], light: MOSS[300], copper: MOSS[400], cabinet: MOSS[300],
    accent: MOSS[500], cable: MOSS[800],
    grass: MOSS[100], tree: MOSS[400], trunk: MOSS[700], house: MOSS.white, roof: MOSS[600], water: MOSS[200], road: MOSS[50],
  },
  realistic: {
    body: 0xeef2ef, band1: 0x0c3a1f, band2: 0x14512c, band3: 0x1f6b3c, band4: 0x3b8a52, band5: 0x6aa877,
    ground: 0xb9c4bd, metal: 0x9aa9a0, dark: 0x2c3b33, light: 0xd9f2e2, copper: MOSS[300], cabinet: 0xc7d3cb,
    accent: MOSS[400], cable: MOSS[900],
    grass: 0x8fae8a, tree: 0x3f6b45, trunk: 0x4a4038, house: 0xd9dcd4, roof: 0x5b6460, water: 0x6f8f8a, road: 0x9a9f98,
  },
  blueprint: {
    body: MOSS[800], band1: MOSS[700], band2: MOSS[700], band3: MOSS[700], band4: MOSS[700], band5: MOSS[700],
    ground: MOSS[900], metal: MOSS[300], dark: MOSS[700], light: MOSS[200], copper: MOSS[200], cabinet: MOSS[300],
    accent: MOSS[300], cable: MOSS[200],
    grass: MOSS[950], tree: MOSS[700], trunk: MOSS[800], house: MOSS[700], roof: MOSS[600], water: MOSS[900], road: MOSS[800],
  },
};

// Landscape parts are lit but never translucent, outlined or edged.
const LANDSCAPE_ROLES = new Set(["grass", "tree", "trunk", "house", "roof", "water", "road"]);
export const isLandscapeRole = (role) => LANDSCAPE_ROLES.has(role);

export const ENVIRONMENTS = {
  cartoon: { skyTop: MOSS[200], skyBottom: MOSS[25], fog: MOSS[50], fogNear: 220, fogFar: 900, exposure: 1.05 },
  realistic: { skyTop: 0x9fcbb2, skyBottom: 0xeef6f1, fog: 0xdbe9e0, fogNear: 350, fogFar: 2600, exposure: 1.0 },
  blueprint: { skyTop: MOSS[950], skyBottom: MOSS[900], fog: MOSS[950], fogNear: 160, fogFar: 700, exposure: 1.0 },
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
    if (role === "light") mat.emissive = new THREE.Color(MOSS[300]);
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
  const metallic = ["metal", "copper", "accent"].includes(role);
  return new THREE.MeshStandardMaterial({
    color,
    roughness: role === "body" ? 0.42 : metallic ? 0.35 : 0.8,
    metalness: metallic ? 0.65 : 0.05,
    emissive: role === "light" ? new THREE.Color(MOSS[200]) : new THREE.Color(0x000000),
    emissiveIntensity: role === "light" ? 1.5 : 0,
  });
}

/** Ink outline (inverted hull, constant width on screen) for the cartoon look. */
export function addOutline(mesh, thickness = 0.0035) {
  const outline = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color: MOSS[900], side: THREE.BackSide, transparent: true })
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
export function addEdges(mesh, color = MOSS[200], opacity = 0.9) {
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
