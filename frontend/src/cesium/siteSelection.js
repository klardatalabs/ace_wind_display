import * as Cesium from "cesium";
import { pickTurbinePart } from "./partPicking.js";

// Pick only our model, never the photogrammetry. Keep DOM positioning out of
// React's render loop and distinguish taps from drags and multi-touch gestures.
export function createSiteSelection(viewer, model, { marker, onSelect }) {
  const { scene } = viewer;
  const canvas = scene.canvas;
  const pointers = new Map();
  const point = new Cesium.Cartesian2();
  const anchor = new Cesium.Cartesian3();
  const originalColor = Cesium.Color.clone(model.silhouetteColor);
  const originalSize = model.silhouetteSize;
  let selected = false;
  let hovered = false;
  let hoverFrame = null;

  function highlight() {
    model.silhouetteColor = Cesium.Color.fromCssColorString("#bfe8ce");
    model.silhouetteSize = selected ? 1.5 : hovered ? 2 : originalSize;
    canvas.style.cursor = pointers.size ? "grabbing" : hovered ? "pointer" : "grab";
  }

  function hitsModel(event) {
    if (!model.ready) return false;
    const bounds = canvas.getBoundingClientRect();
    point.x = event.clientX - bounds.left;
    point.y = event.clientY - bounds.top;
    const size = event.pointerType === "touch" ? 15 : 5;
    const picked = scene.pick(point, size, size);
    if (picked?.primitive !== model) return null;
    return pickTurbinePart(picked, model);
  }

  function down(event) {
    if (event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: false, hit: hitsModel(event) });
    if (pointers.size > 1) for (const pointer of pointers.values()) pointer.moved = true;
    canvas.setPointerCapture(event.pointerId);
    highlight();
  }

  function move(event) {
    const pointer = pointers.get(event.pointerId);
    if (pointer) {
      if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) pointer.moved = true;
      return;
    }
    if (event.pointerType === "touch" || hoverFrame !== null) return;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = null;
      hovered = hitsModel(event);
      highlight();
    });
  }

  function up(event) {
    const pointer = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    // A rotating blade may move between down and up, so remember the first hit.
    if (pointer && !pointer.moved && event.type === "pointerup") {
      const picked = pointer.hit || hitsModel(event);
      if (picked) onSelect(picked);
    }
    highlight();
  }

  function leave() {
    if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
    hoverFrame = null;
    hovered = false;
    highlight();
  }

  function positionMarker() {
    const element = marker();
    if (!element || selected || !model.ready) return;
    const sphere = model.boundingSphere;
    const normal = scene.ellipsoid.geodeticSurfaceNormal(sphere.center, anchor);
    Cesium.Cartesian3.multiplyByScalar(normal, sphere.radius * 0.7, anchor);
    Cesium.Cartesian3.add(sphere.center, anchor, anchor);
    const screen = Cesium.SceneTransforms.worldToWindowCoordinates(scene, anchor, point);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const visible = screen && screen.x > 105 && screen.x < width - 105 && screen.y > 85 && screen.y < height - 70;
    element.dataset.anchored = String(Boolean(visible));
    element.style.transform = visible
      ? `translate(${Math.round(screen.x)}px, ${Math.round(screen.y)}px) translate(-50%, -100%)`
      : "translate(16px, 64px)";
  }

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("pointerleave", leave);
  const removeRender = scene.postRender.addEventListener(positionMarker);
  highlight();

  return {
    setSelected(value) { selected = value; highlight(); },
    dispose() {
      leave();
      removeRender();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("pointerleave", leave);
      for (const id of pointers.keys()) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      pointers.clear();
      canvas.style.cursor = "";
      model.silhouetteColor = originalColor;
      model.silhouetteSize = originalSize;
    },
  };
}
