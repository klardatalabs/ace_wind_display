import * as THREE from "three";

// Inspection targets belong to a room and to a physical object, not just a card ID.
export function inspectable(object, id, room, details = {}) {
  object.userData.inspection = { id, room, ...details };
  return object;
}

export function inspectionRoot(object) {
  for (let current = object; current; current = current.parent) {
    if (current.userData.inspection) return current;
  }
  return null;
}

export function inspectionTargets(root, id, room) {
  const targets = [];
  root.traverse(object => {
    const target = object.userData.inspection;
    if (target?.id === id && target.room === room) targets.push(object);
  });
  return targets;
}

// Three's CPU raycaster does not apply the GPU's material clipping planes.
export function visibleIntersection(hit) {
  for (let object = hit.object; object; object = object.parent) {
    if (!object.visible || object.userData.noPick || object.userData.isOutline || object.userData.isEdges) return false;
  }
  const material = Array.isArray(hit.object.material)
    ? hit.object.material[hit.face?.materialIndex ?? 0] : hit.object.material;
  if (!material || !material.visible || material.opacity === 0) return false;
  const planes = material.clippingPlanes;
  if (!planes?.length) return true;
  const outside = plane => plane.distanceToPoint(hit.point) < -1e-5;
  return !(material.clipIntersection ? planes.every(outside) : planes.some(outside));
}

export function inspectionFrame(object, instanceId = null) {
  object.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3();
  if (object.isInstancedMesh && Number.isInteger(instanceId)) {
    object.geometry.computeBoundingBox();
    const transform = new THREE.Matrix4();
    object.getMatrixAt(instanceId, transform);
    transform.premultiply(object.matrixWorld);
    bounds.copy(object.geometry.boundingBox).applyMatrix4(transform);
  } else bounds.setFromObject(object);
  const center = bounds.getCenter(new THREE.Vector3());
  const anchor = object.userData.inspection?.anchor;
  if (anchor) center.fromArray(anchor).applyMatrix4(object.matrixWorld);
  return { center, size: bounds.getSize(new THREE.Vector3()) };
}

export function cablePointAtHeight(object, height) {
  const curve = object.geometry?.parameters?.path;
  if (!curve) return null;
  const localHeight = new THREE.Vector3(0, height, 0).applyMatrix4(object.matrixWorld.clone().invert()).y;
  let low = 0, high = 1;
  // The tower cable is authored from top to bottom. Find the actual bend at this
  // level instead of aiming at the middle of its full-height bounding box.
  for (let i = 0; i < 18; i++) {
    const middle = (low + high) / 2;
    if (curve.getPoint(middle).y > localHeight) low = middle;
    else high = middle;
  }
  return curve.getPoint((low + high) / 2).applyMatrix4(object.matrixWorld);
}

// A winding must remain visible even when a bearing, rotor face, or neighbouring
// coil lies between it and the aisle. Keep an opaque copy at the same transform
// and fade the surrounding assembly only for this inspection.
export class WindingInspection {
  constructor() { this.originals = []; this.proxy = null; this.coils = null; this.context = null; }

  clear() {
    if (this.proxy) {
      this.proxy.removeFromParent();
      this.proxy.material.dispose();
      this.proxy = null;
    }
    for (const { mesh, material, castShadow, ghost } of this.originals) {
      const faded = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const entry of faded) entry.dispose();
      mesh.material = material;
      mesh.castShadow = castShadow;
      if (ghost === undefined) delete mesh.userData.inspectionGhost;
      else mesh.userData.inspectionGhost = ghost;
    }
    this.originals = [];
    this.coils = null;
    this.context = null;
  }

  select(coils, instanceId, context) {
    if (this.proxy && this.coils === coils && this.context === context) {
      coils.getMatrixAt(instanceId, this.proxy.matrix);
      this.proxy.matrixWorldNeedsUpdate = true;
      this.proxy.userData.inspectionProxy.instanceId = instanceId;
      return;
    }
    this.clear();
    const source = coils.material;
    const opaque = source.clone();
    opaque.transparent = false;
    opaque.opacity = 1;
    opaque.depthWrite = true;
    context.traverse(mesh => {
      if (!mesh.isMesh || !mesh.visible || mesh.userData.noPick || mesh.userData.isOutline || mesh.userData.isAnnotation) return;
      this.originals.push({ mesh, material: mesh.material, castShadow: mesh.castShadow, ghost: mesh.userData.inspectionGhost });
      const fade = material => {
        const faded = material.clone();
        faded.transparent = true;
        faded.opacity = Math.min(.14, material.opacity);
        faded.depthWrite = false;
        return faded;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(fade) : fade(mesh.material);
      mesh.castShadow = false;
      mesh.userData.inspectionGhost = true;
    });
    const proxy = new THREE.Mesh(coils.geometry, opaque);
    proxy.name = "InspectedWinding";
    proxy.matrixAutoUpdate = false;
    coils.getMatrixAt(instanceId, proxy.matrix);
    proxy.userData.inspectionProxy = { object: coils, instanceId };
    coils.add(proxy);
    this.proxy = proxy;
    this.coils = coils;
    this.context = context;
  }
}

export class InspectionHighlight {
  constructor() { this.lines = []; }

  clear() {
    for (const line of this.lines) {
      line.removeFromParent();
      line.geometry.dispose();
      line.material.dispose();
    }
    this.lines = [];
  }

  select(root, instanceId = null) {
    this.clear();
    const meshes = [];
    root.traverse(object => { if (object.isMesh && object.visible && !object.userData.noPick && !object.userData.inspectionProxy) meshes.push(object); });
    for (const mesh of meshes) {
      const geometry = new THREE.EdgesGeometry(mesh.geometry, 28);
      const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const material = new THREE.LineBasicMaterial({
        color: 0xa6e9ff, transparent: true, opacity: .95, depthTest: true,
        clippingPlanes: source?.clippingPlanes, clipIntersection: source?.clipIntersection,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      });
      const line = new THREE.LineSegments(geometry, material);
      line.userData.noPick = true;
      if (mesh.isInstancedMesh) {
        // One winding or rung is selected, rather than every instance at once.
        const index = mesh === root && Number.isInteger(instanceId) ? instanceId : 0;
        mesh.getMatrixAt(index, line.matrix);
        line.matrixAutoUpdate = false;
      }
      mesh.add(line);
      this.lines.push(line);
    }
  }
}
