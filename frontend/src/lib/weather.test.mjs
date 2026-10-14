import test from "node:test";
import assert from "node:assert/strict";
import { isOverridden, realWeather, weatherLook } from "./weather.js";
import { sunPosition } from "./sun.js";

const reading = { condition: "Clouds", cloudCover: 0.47, rainMmH: 0, visibilityM: 10000 };
const clear = { hour: null, cloud: null, rain: null, fog: null };

test("an admin override hides the real weather", () => {
  assert.equal(isOverridden({ override: clear }), false);
  assert.equal(realWeather({ weather: reading, override: clear }), reading);
  assert.equal(isOverridden({ override: { ...clear, rain: 0.8 } }), true);
  assert.equal(realWeather({ weather: reading, override: { ...clear, hour: 20 } }), null);
  assert.equal(realWeather(null), null);
});

test("weather look comes only from a real reading", () => {
  assert.deepEqual(weatherLook(null), { cloud: 0, rain: 0, fog: 0, raining: false });
  const look = weatherLook(reading);
  assert.equal(look.cloud, 0.47);
  assert.equal(look.raining, false);
  assert.equal(look.fog, 0);
  assert.equal(weatherLook({ ...reading, condition: "Drizzle", rainMmH: 0.3 }).raining, true);
  assert.ok(weatherLook({ ...reading, condition: "Mist", visibilityM: 2000 }).fog >= 0.55);
});

test("sun is up at midday and down at midnight in Bristol", () => {
  const deg = (d) => (sunPosition(d).elevation * 180) / Math.PI;
  assert.ok(deg(new Date("2026-06-21T12:00:00Z")) > 55);
  assert.ok(deg(new Date("2026-06-21T23:30:00Z")) < -5);
});
