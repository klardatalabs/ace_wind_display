import test from "node:test";
import assert from "node:assert/strict";
import { readLatest, readStatus } from "./live.js";
import { normaliseScadaPage, scadaPages } from "./history.js";
import { normaliseTimestamp } from "./telemetry.js";
import { retryAfterSeconds } from "./http.js";

const clock = Date.parse("2026-10-12T12:00:00Z");
const FIELDS = [
  ["wec_active_power", "activePowerKw", -1000, 6500, true],
  ["wec_operating_hours", "operatingHours", 0, Infinity, false],
];
const latest = (overrides = {}) => ({
  timestamps: [clock * 1000],
  series: { wec_active_power: [0], wec_operating_hours: [19_000] },
  ...overrides,
});

test("live readings accept zero power and good (any case) quality", () => {
  assert.equal(readLatest(latest(), FIELDS, clock).values.activePowerKw, 0);
  assert.equal(readLatest(latest({ quality: ["Good"] }), FIELDS, clock).values.activePowerKw, 0);
  assert.equal(+readLatest(latest(), FIELDS, clock).observedAt, clock);
});

test("live readings reject stale, bad-quality, non-finite and missing required values", () => {
  assert.throws(() => readLatest(latest({ quality: ["bad"] }), FIELDS, clock));
  assert.throws(() => readLatest(latest(), FIELDS, clock + 31_000), /stale/);
  assert.throws(() => readLatest(latest({ series: { wec_active_power: [NaN] } }), FIELDS, clock));
  assert.throws(() => readLatest(latest({ series: {} }), FIELDS, clock), /Missing/);
});

test("a missing optional field becomes null instead of failing the reading", () => {
  const r = readLatest(latest({ series: { wec_active_power: [120] } }), FIELDS, clock);
  assert.equal(r.values.activePowerKw, 120);
  assert.equal(r.values.operatingHours, null);
});

test("status events need an integer status and 0/1 flags", () => {
  assert.deepEqual(readStatus({ main_status: 0, substatus: 1, fault_message_flag: 0, warning_message_flag: 1, service_flag: 0 }), {
    mainStatus: 0, substatus: 1, faultMessage: false, warningMessage: true, serviceMode: false,
  });
  assert.throws(() => readStatus({ main_status: 0, fault_message_flag: 9, service_flag: 0 }));
  assert.throws(() => readStatus(undefined));
});

test("equal timestamp representations collapse to one UTC instant", () => {
  const expected = "2026-09-30T23:50:00.000Z";
  for (const raw of ["2026-09-30T23:50:00Z", expected, "2026-10-01T00:50:00+01:00", 1790812200000000]) {
    assert.equal(normaliseTimestamp(raw, true), expected);
  }
  assert.throws(() => normaliseTimestamp("2026-09-30T23:51:00Z", true));
  assert.throws(() => normaliseTimestamp("2026-09-30T23:50:00"));
});

test("history keeps zero and negative power, drops bad rows and contradictory extremes", () => {
  const page = {
    timestamps: [1790812200000000],
    series: { wind_speed_mean: [4], wind_speed_max: [5], active_power_mean: [-2], active_power_max: [0], energy_produced: [100] },
    quality: ["good"],
  };
  assert.equal(normaliseScadaPage(page).records[0].activePowerMeanKw, -2);
  assert.equal(normaliseScadaPage({ ...page, quality: ["bad"] }).rejected, 1);
  const contradictory = normaliseScadaPage({ ...page, series: { ...page.series, wind_speed_max: [3] } }).records[0];
  assert.equal(contradictory.windSpeedMaxMs, null, "a max below the mean is dropped");
  assert.equal(normaliseScadaPage({ ...page, series: { ...page.series, active_power_mean: [9000] } }).records[0].activePowerMeanKw, null);
  assert.throws(() => normaliseScadaPage({ ...page, series: { ...page.series, active_power_mean: [] } }), /Misaligned/);
});

test("history pages are fetched one after another and a repeated cursor aborts", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    assert.equal(new URL(url).searchParams.get("cursor"), calls === 1 ? null : "second");
    return Response.json({
      timestamps: [1790812200000000 + (calls - 1) * 600_000_000],
      series: { active_power_mean: [calls] },
      page: { next_cursor: calls === 1 ? "second" : null, has_more: calls === 1 },
    });
  };
  try {
    const pages = [];
    for await (const p of scadaPages({ start: "a", end: "b" })) pages.push(p);
    assert.deepEqual(pages.map((p) => p.records[0].activePowerMeanKw), [1, 2]);

    calls = 0;
    globalThis.fetch = async () =>
      Response.json({ timestamps: [1790812200000000 + calls++ * 600_000_000], series: { active_power_mean: [1] }, page: { next_cursor: "repeat", has_more: true } });
    await assert.rejects(async () => {
      for await (const _ of scadaPages({ start: "a", end: "b" }));
    }, /Repeated/);
  } finally {
    globalThis.fetch = original;
  }
});

test("Retry-After accepts seconds or an HTTP date", () => {
  assert.equal(retryAfterSeconds("7", 1), 7);
  assert.equal(retryAfterSeconds(null, 4), 4);
  const inTenSeconds = new Date(Date.now() + 10_000).toUTCString();
  assert.ok(retryAfterSeconds(inTenSeconds, 1) > 8);
});
