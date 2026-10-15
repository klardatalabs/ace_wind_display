// The live 3D view in real time. The clock follows the real time, so the sun, and the
// turbine's shadow, sit where they really are over Lawrence Weston right now. A colour grade
// then matches the time of day and the real weather: dimmer and bluer at night, warmer around
// sunrise and sunset, greyer under cloud and rain, hazier in fog. Google's 3D tiles have
// daylight baked in, so night is a dim, moonlit version of the day rather than true darkness.

import * as Cesium from "cesium";
import { useEnvironmentStore } from "../store/useEnvironmentStore.js";
import { realWeather, weatherLook } from "../lib/weather.js";
import { sunPosition } from "../lib/sun.js";
import { SITE_COORDS } from "./siteConfig.js";

const REFRESH_MS = 10_000;

const GRADE_SHADER = `
uniform sampler2D colorTexture;
uniform float brightness;
uniform float saturation;
uniform vec3 tint;
uniform vec3 hazeColor;
uniform float haze;
in vec2 v_textureCoordinates;
void main() {
  vec4 color = texture(colorTexture, v_textureCoordinates);
  float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 rgb = mix(vec3(luma), color.rgb, saturation) * tint * brightness;
  out_FragColor = vec4(mix(rgb, hazeColor, haze), color.a);
}
`;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const MOONLIGHT = [0.62, 0.72, 1.0];
const GOLDEN = [1.0, 0.82, 0.66];

/** The colour grade for a sun elevation (degrees) and the weather's look. */
export function siteGrade(elevationDeg, { cloud, rain, fog }) {
  const day = smooth(-6, 10, elevationDeg);
  const golden = smooth(-7, 0, elevationDeg) * (1 - smooth(5, 16, elevationDeg));
  const grey = Math.min(1, cloud * 0.8 + rain * 0.5);
  const tint = mix3(mix3([1, 1, 1], GOLDEN, golden * 0.8), MOONLIGHT, 1 - day);
  return {
    day,
    brightness: (0.32 + 0.68 * day) * (1 - grey * 0.15),
    saturation: (0.45 + 0.55 * day) * (1 - grey * 0.3),
    tint,
    haze: Math.min(0.45, fog * 0.4 + rain * 0.08),
    hazeColor: mix3([0.08, 0.11, 0.18], [0.78, 0.81, 0.85], day),
  };
}

/**
 * Drives the viewer from the real clock and the real weather. `tileset` is optional (it is
 * missing when clipping isn't supported). Returns a cleanup function, with `setTime(date)`
 * on it to show another moment (a time-lapse) instead of now; `setTime(null)` returns to now.
 */
export function applySiteEnvironment(viewer, tileset) {
  const { scene, clock } = viewer;
  clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
  clock.shouldAnimate = true;
  scene.globe.enableLighting = true;
  scene.fog.enabled = true;
  viewer.shadowMap.softShadows = true;
  viewer.shadowMap.darkness = 0.35;
  // The tiles' own shadows are baked in; they only receive the turbine's.
  if (tileset) tileset.shadows = Cesium.ShadowMode.RECEIVE_ONLY;

  const uniforms = { brightness: 1, saturation: 1, tint: new Cesium.Cartesian3(1, 1, 1), hazeColor: new Cesium.Cartesian3(1, 1, 1), haze: 0 };
  const stage = scene.postProcessStages.add(
    new Cesium.PostProcessStage({
      name: "site_real_sky",
      fragmentShader: GRADE_SHADER,
      uniforms: {
        brightness: () => uniforms.brightness,
        saturation: () => uniforms.saturation,
        tint: () => uniforms.tint,
        hazeColor: () => uniforms.hazeColor,
        haze: () => uniforms.haze,
      },
    })
  );

  let shown = null; // a Date to show instead of now

  function update() {
    const elevationDeg = (sunPosition(shown ?? new Date(), SITE_COORDS.lat, SITE_COORDS.lon).elevation * 180) / Math.PI;
    const look = weatherLook(realWeather(useEnvironmentStore.getState().environment));
    const grade = siteGrade(elevationDeg, look);
    uniforms.brightness = grade.brightness;
    uniforms.saturation = grade.saturation;
    Cesium.Cartesian3.fromArray(grade.tint, 0, uniforms.tint);
    Cesium.Cartesian3.fromArray(grade.hazeColor, 0, uniforms.hazeColor);
    uniforms.haze = grade.haze;
    // A low sun throws shadows across the whole site; below the horizon there are none.
    viewer.shadows = elevationDeg > 3;
    scene.fog.density = 0.0002 + look.fog * 0.003;
  }

  update();
  const timer = setInterval(update, REFRESH_MS);
  const unsubscribe = useEnvironmentStore.subscribe(update);
  const stop = () => {
    clearInterval(timer);
    unsubscribe();
    if (!scene.isDestroyed()) scene.postProcessStages.remove(stage);
  };
  stop.setTime = (date) => {
    shown = date;
    // The sun, the sky and the turbine's shadow follow the clock.
    clock.shouldAnimate = !date;
    clock.currentTime = Cesium.JulianDate.fromDate(date ?? new Date());
    update();
  };
  return stop;
}
