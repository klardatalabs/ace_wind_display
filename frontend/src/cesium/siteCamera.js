import * as Cesium from "cesium";
import { SITE_COORDS } from "./siteConfig.js";

// Cesium owns drag/pinch input. This controller owns deliberate camera journeys.
export function createSiteCamera(viewer, groundHeightM, model) {
  const { camera, scene } = viewer;
  const canvas = scene.canvas;
  const overview = new Cesium.BoundingSphere(
    Cesium.Cartesian3.fromDegrees(SITE_COORDS.lon, SITE_COORDS.lat, groundHeightM + 80), 100,
  );
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let pendingFrame = null;
  let cardOpen = false;

  function frameCard(open) {
    cardOpen = open;
    viewer.resize();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const frustum = camera.frustum;
    const verticalHalf = frustum.fovy / 2;
    const horizontalHalf = Math.atan(Math.tan(verticalHalf) * width / height);
    const mobile = width <= 680;
    frustum.xOffset = open && !mobile ? frustum.near * Math.tan(horizontalHalf) * (width > 900 ? 368 : 320) / width : 0;
    frustum.yOffset = open && mobile ? -frustum.near * Math.tan(verticalHalf) * .42 : 0;
  }

  function cancel() {
    if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
    pendingFrame = null;
    camera.cancelFlight();
  }

  function travel(close, immediate = false, partSphere = null) {
    cancel();
    // Let React make room for the card before fitting the model to the viewport.
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null;
      viewer.resize();
      if (cardOpen) frameCard(true);
      const sphere = Cesium.BoundingSphere.clone(partSphere ?? (close && model.ready ? model.boundingSphere : overview));
      if (close) sphere.radius *= 1.18;
      const widthRatio = cardOpen && canvas.clientWidth > 680 ? 1 - (canvas.clientWidth > 900 ? 368 : 320) / canvas.clientWidth : 1;
      const heightRatio = cardOpen && canvas.clientWidth <= 680 ? .58 : 1;
      const verticalHalf = Math.atan(Math.tan(camera.frustum.fovy / 2) * heightRatio);
      const horizontalHalf = Math.atan(Math.tan(camera.frustum.fovy / 2) * canvas.clientWidth / canvas.clientHeight * widthRatio);
      const range = close ? sphere.radius / Math.sin(Math.min(verticalHalf, horizontalHalf)) : 650;
      camera.flyToBoundingSphere(sphere, {
        duration: immediate || reducedMotion.matches ? 0 : 1.25,
        offset: new Cesium.HeadingPitchRange(
          close ? camera.heading : Cesium.Math.toRadians(215), Cesium.Math.toRadians(close ? -18 : -42), range,
        ),
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      });
    });
  }

  function zoom(factor) {
    cancel();
    const height = camera.positionCartographic.height - groundHeightM;
    const nextHeight = Cesium.Math.clamp(height * factor, scene.screenSpaceCameraController.minimumZoomDistance, 4500);
    camera.zoomIn(height - nextHeight);
  }

  // A slow, steady circle round the turbine, for screens nobody is driving.
  let stopOrbit = null;
  function orbit(on, { range = 480, pitchDeg = -24, degPerSecond = 4 } = {}) {
    stopOrbit?.();
    stopOrbit = null;
    if (!on) return camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    cancel();
    const centre = Cesium.Cartesian3.fromDegrees(SITE_COORDS.lon, SITE_COORDS.lat, groundHeightM + 70);
    let heading = Cesium.Math.toRadians(215);
    let last = performance.now();
    const step = () => {
      const now = performance.now();
      if (!reducedMotion.matches) heading += Cesium.Math.toRadians(degPerSecond) * Math.min(0.1, (now - last) / 1000);
      last = now;
      camera.lookAt(centre, new Cesium.HeadingPitchRange(heading, Cesium.Math.toRadians(pitchDeg), range));
    };
    stopOrbit = scene.preUpdate.addEventListener(step);
  }

  canvas.addEventListener("pointerdown", cancel);
  canvas.addEventListener("wheel", cancel, { passive: true });
  travel(false, true);

  return {
    focus: (sphere) => travel(true, false, sphere),
    frameCard,
    reset: () => travel(false),
    cancel,
    zoom,
    orbit,
    dispose() {
      cancel();
      stopOrbit?.();
      canvas.removeEventListener("pointerdown", cancel);
      canvas.removeEventListener("wheel", cancel);
    },
  };
}
