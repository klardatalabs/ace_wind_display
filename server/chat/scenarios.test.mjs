import { test } from "node:test";
import assert from "node:assert/strict";
import { windSpeedScenario } from "./scenarios.js";

test("what-if answer labels assumptions and avoids claiming measured output", () => {
  const answer = windSpeedScenario("What if the wind were 10% faster?");
  assert.match(answer, /33%/);
  assert.match(answer, /hypothetical/);
  assert.match(answer, /not an ACE reading/);
  assert.equal(windSpeedScenario("How fast is it now?"), null);
});
