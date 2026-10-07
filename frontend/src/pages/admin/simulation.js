// Turns simulator inputs into the payload POST /api/admin/simulate expects.

import { simulateNow } from "@shared/physics.js";
import { CUT_IN_WIND_MS, CUT_OUT_LOW_MS } from "@shared/constants.js";

/**
 * @param {object} input
 * @param {number} input.wind            m/s
 * @param {number} input.deg             nacelle bearing
 * @param {number|null} [input.curtailKw] grid setpoint cap, null = none
 * @param {{ fault?: boolean, service?: boolean, warning?: boolean }} [input.flags]
 * @param {{ powerKw?: number|null, rpm?: number|null }} [input.manual]  override the physics
 * @param {number|null} [input.todayKwh]
 */
export function buildSimulation({ wind, deg, curtailKw = null, flags = {}, manual = {}, todayKwh = null }) {
  const now = simulateNow({ windMs: wind, nacelleDeg: deg, curtailKw });
  const stopped = flags.fault || flags.service;
  if (stopped) Object.assign(now, { activePowerKw: 0, rotorRpm: 0 });
  if (manual.powerKw != null) now.activePowerKw = Math.round(manual.powerKw);
  if (manual.rpm != null) now.rotorRpm = Number(manual.rpm.toFixed(2));

  const mainStatus = flags.service ? 9 : wind < CUT_IN_WIND_MS || wind >= CUT_OUT_LOW_MS || curtailKw != null ? 1 : 0;
  const payload = {
    now,
    statusEvent: {
      main_status: mainStatus,
      substatus: 0,
      fault_message_flag: flags.fault ? 1 : 0,
      warning_message_flag: flags.warning ? 1 : 0,
      service_flag: flags.service ? 1 : 0,
    },
  };
  if (todayKwh != null) payload.today = { energyKwh: todayKwh };
  return payload;
}
