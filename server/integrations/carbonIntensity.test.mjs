import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseRegional } from "./carbonIntensity.js";

const response = { data: [{ shortname: "South West England", data: [{ from: "2026-10-27T12:00:00Z", to: "2026-10-27T12:30:00Z", intensity: { forecast: 140, index: "low" }, generationmix: [] }] }] };

test("regional forecast is accepted only during its stated interval", () => {
  assert.equal(normaliseRegional(response, Date.parse("2026-10-27T12:15:00Z")).intensity, 140);
  assert.throws(() => normaliseRegional(response, Date.parse("2026-10-27T12:30:00Z")), /not current/);
  assert.throws(() => normaliseRegional(response, Date.parse("2026-10-27T11:59:59Z")), /not current/);
});
