import * as Cesium from "cesium";
import { useLiveStore } from "../store/useLiveStore.js";
import { SITE_COORDS, TURBINE_MODEL_URL } from "./siteConfig.js";

export function turbineModelMatrix(config, groundHeightM) {
  const origin = Cesium.Cartesian3.fromDegrees(SITE_COORDS.lon, SITE_COORDS.lat, groundHeightM + config.turbineHeightOffsetM);
  const heading = Cesium.Math.toRadians(config.turbineHeadingDeg);
  const frame = Cesium.Transforms.headingPitchRollToFixedFrame(origin, new Cesium.HeadingPitchRoll(heading, 0, 0));
  return Cesium.Matrix4.multiplyByUniformScale(frame, config.turbineScale, new Cesium.Matrix4());
}

export async function loadTurbineModel(config, groundHeightM) {
  return Cesium.Model.fromGltfAsync({
    url: TURBINE_MODEL_URL,
    modelMatrix: turbineModelMatrix(config, groundHeightM),
    shadows: Cesium.ShadowMode.ENABLED,
  });
}

// The GLB has named nodes, but no animation clips. Match the guided viewer's
// RPM and nacelle-bearing convention while keeping the Cesium model independent.
export function animateTurbine(scene, model) {
  let spin = 0;
  let previous = performance.now();
  let rotor;
  let yaw;
  const rotation = new Cesium.Matrix4();
  const apply = () => {
    if (!model.ready) return;
    rotor ??= model.getNode("RotorSpin");
    yaw ??= model.getNode("Yaw");
    const now = performance.now();
    const dt = Math.min((now - previous) / 1000, 0.1);
    previous = now;
    const live = useLiveStore.getState().state?.now;
    const rpm = Number.isFinite(live?.rotorRpm) ? Math.max(0, live.rotorRpm) : 0;
    spin -= dt * rpm * (2 * Math.PI / 60);
    if (rotor) {
      Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromRotationX(spin), Cesium.Cartesian3.ZERO, rotation);
      rotor.matrix = Cesium.Matrix4.multiply(rotor.originalMatrix, rotation, new Cesium.Matrix4());
    }
    if (yaw && Number.isFinite(live?.nacelleDeg)) {
      const angle = -Cesium.Math.toRadians(live.nacelleDeg - 215);
      Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromRotationY(angle), Cesium.Cartesian3.ZERO, rotation);
      yaw.matrix = Cesium.Matrix4.multiply(yaw.originalMatrix, rotation, new Cesium.Matrix4());
    }
  };
  scene.preUpdate.addEventListener(apply);
  return () => scene.preUpdate.removeEventListener(apply);
}
