import * as Cesium from "cesium";
import { SITE_COORDS } from "./siteConfig.js";

export function createSiteCamera(viewer, groundHeightM) {
  const scene = viewer.scene;
  const controller = scene.screenSpaceCameraController;
  const canvas = scene.canvas;
  const focus = Cesium.Cartesian3.fromDegrees(SITE_COORDS.lon, SITE_COORDS.lat, groundHeightM + 64);
  const orbit = { heading: Cesium.Math.toRadians(215), pitch: Cesium.Math.toRadians(-42), range: 540 };
  const pointers = new Map();
  let previousPinch = null;
  let mode = "orbit";

  function renderOrbit() {
    viewer.camera.lookAt(focus, new Cesium.HeadingPitchRange(orbit.heading, orbit.pitch, orbit.range));
  }

  function setMode(next) {
    mode = next;
    pointers.clear();
    previousPinch = null;
    controller.enableInputs = next === "explore";
    canvas.style.touchAction = next === "orbit" ? "none" : "auto";
    if (next === "orbit") renderOrbit();
    else viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  }

  function reset() {
    orbit.heading = Cesium.Math.toRadians(215);
    orbit.pitch = Cesium.Math.toRadians(-42);
    orbit.range = 540;
    setMode("orbit");
  }

  function zoom(factor) {
    orbit.range = Cesium.Math.clamp(orbit.range * factor, 35, 4500);
    if (mode === "orbit") renderOrbit();
  }

  function onPointerDown(event) {
    if (mode !== "orbit") return;
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function onPointerMove(event) {
    if (mode !== "orbit" || !pointers.has(event.pointerId)) return;
    const prior = pointers.get(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (previousPinch) zoom(previousPinch / distance);
      previousPinch = distance;
      return;
    }
    previousPinch = null;
    orbit.heading -= (event.clientX - prior.x) * 0.006;
    orbit.pitch = Cesium.Math.clamp(orbit.pitch + (event.clientY - prior.y) * 0.004, Cesium.Math.toRadians(-86), Cesium.Math.toRadians(-5));
    renderOrbit();
  }

  function onPointerUp(event) {
    pointers.delete(event.pointerId);
    previousPinch = null;
  }

  function onWheel(event) {
    if (mode !== "orbit") return;
    event.preventDefault();
    zoom(Math.exp(event.deltaY * 0.001));
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  reset();

  return {
    setMode,
    reset,
    zoom,
    dispose() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    },
  };
}
