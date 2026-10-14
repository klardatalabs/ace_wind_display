import * as Cesium from "cesium";

const NAMES = [
  [/TowerEntrance/, "door"], [/Foundation/, "foundation"], [/Transformer/, "transformer"],
  [/Aviation/, "light"], [/RoofSensors/, "sensors"], [/GeneratorRotor/, "generator"],
  [/NacelleInternals/, "machinery"], [/NacelleShell/, "nacelle"], [/Blade/, "blade"],
  [/Spinner|ACE_Hub/, "hub"], [/Tower/, "tower"],
];
export const partIdForNode = (name = "") => NAMES.find(([pattern]) => pattern.test(name))?.[1] ?? "turbine";
const nodeName = (node) => node?.node?.name ?? node?._name ?? node?.name ?? "";

// Cesium exposes runtime node/primitive details on model picks. Keep that
// version-specific boundary here; a missing detail falls back to the whole model.
function nodeSphere(model, node) {
  const matrix = model._sceneGraph?.computedModelMatrix;
  if (!matrix || !node?.computedTransform) return null;
  const transform = Cesium.Matrix4.multiply(matrix, node.computedTransform, new Cesium.Matrix4());
  let result;
  for (const primitive of node.runtimePrimitives ?? []) {
    if (!primitive.boundingSphere) continue;
    const sphere = Cesium.BoundingSphere.transform(primitive.boundingSphere, transform, new Cesium.BoundingSphere());
    result = result ? Cesium.BoundingSphere.union(result, sphere, result) : sphere;
  }
  return result;
}

export function pickTurbinePart(picked, model) {
  if (picked?.primitive !== model) return null;
  const node = picked.detail?.node;
  return { id: partIdForNode(nodeName(node)), sphere: nodeSphere(model, node) ?? Cesium.BoundingSphere.clone(model.boundingSphere) };
}

export function findTurbinePart(model, id) {
  if (!model.ready) return { id, sphere: null };
  const nodes = model._sceneGraph?._runtimeNodes ?? [];
  let sphere;
  for (const node of nodes) {
    if (!node || partIdForNode(nodeName(node)) !== id) continue;
    // Inspect one blade, rather than fitting all three blades as one selection.
    if (id === "blade" && !nodeName(node).includes("Blade_1")) continue;
    const bound = nodeSphere(model, node);
    if (bound) sphere = sphere ? Cesium.BoundingSphere.union(sphere, bound, sphere) : bound;
  }
  return { id, sphere: sphere ?? Cesium.BoundingSphere.clone(model.boundingSphere) };
}
