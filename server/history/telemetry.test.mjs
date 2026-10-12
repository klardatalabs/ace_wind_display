import test from 'node:test';
import assert from 'node:assert/strict';
import { londonDayStart, londonHour, londonHourToDate } from '../../shared/time.js';
import { normaliseTimestamp, normaliseHistoryPage } from './telemetry.js';

test('London midnight uses the offset at midnight on transition days', () => {
  assert.equal(londonDayStart(new Date('2026-10-25T12:00:00Z')).toISOString(), '2026-10-24T23:00:00.000Z');
  assert.equal(londonDayStart(new Date('2026-03-29T12:00:00Z')).toISOString(), '2026-03-29T00:00:00.000Z');
  assert.equal(londonHour(new Date('2026-10-25T12:00:00Z')), 12);
  assert.equal(londonHourToDate(12, new Date('2026-10-25T12:00:00Z')).toISOString(), '2026-10-25T12:00:00.000Z');
});
test('equal timestamp representations collapse to one UTC key', () => {
  const expected = '2026-09-30T23:50:00.000Z';
  for (const raw of ['2026-09-30T23:50:00Z', expected, '2026-10-01T00:50:00+01:00', 1790812200000000]) {
    assert.equal(normaliseTimestamp(raw, true), expected);
  }
  assert.throws(() => normaliseTimestamp('2026-09-30T23:51:00Z', true));
  assert.throws(() => normaliseTimestamp('2026-09-30T23:50:00'));
});
test('history keeps zero and negative net power; invalid fields become partial', () => {
  const page = { timestamps: [1790812200000000], series: {wind_speed_mean:[4],wind_speed_max:[5],active_power_mean:[-2],active_power_max:[0],energy_produced:[100]}, quality:['good'] };
  const {records} = normaliseHistoryPage(page);
  assert.equal(records[0].active_power_mean_kw, -2);
  assert.equal(records[0].quality, 'complete');
  page.series.wind_speed_max = [NaN];
  assert.equal(normaliseHistoryPage(page).records[0].quality, 'partial');
  page.series.active_power_mean=[9000];
  assert.equal(normaliseHistoryPage(page).records[0].active_power_mean_kw,null);
  page.series.active_power_mean = [];
  assert.throws(() => normaliseHistoryPage(page));
});
