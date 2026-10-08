// Loads the meshopt-compressed GLB and returns named handles to the parts we animate.
// Node names come from assets/source/ace-turbine.blend.

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

export const MODEL_URL = "/models/ace-turbine.glb";

// Hub sits at Yaw (y=89) + RotorTilt (+4.6, +3): handy for camera shots.
export const HUB_LOCAL = { x: 4.6, y: 92, z: 0 };

export async function loadTurbine(url = MODEL_URL) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;
  const get = (name) => root.getObjectByName(name);

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.userData.materialName = o.material?.name || "";
    }
  });

  return {
    root,
    yaw: get("Yaw"),
    rotorTilt: get("RotorTilt"),
    rotorSpin: get("RotorSpin"),
    tower: get("ACE_Tower"),
    towerBands: get("ACE_TowerBands"),
    towerEntrance: get("ACE_TowerEntrance"),
    foundation: get("ACE_Foundation"),
    transformer: get("ACE_TransformerStation"),
    nacelleShell: get("ACE_NacelleShell"),
    nacelleInternals: get("ACE_NacelleInternals"),
    roofSensors: get("ACE_RoofSensors"),
    aviationLight: get("ACE_AviationLight"),
    generatorRotor: get("ACE_GeneratorRotor"),
    hub: get("ACE_Hub"),
    spinner: get("ACE_Spinner"),
    blades: [1, 2, 3].map((i) => get(`ACE_Blade_${i}`)),
  };
}

/** All meshes under an object (a glTF node with several primitives is a Group of Meshes). */
export function meshesOf(object) {
  const out = [];
  object?.traverse((o) => o.isMesh && out.push(o));
  return out;
}
