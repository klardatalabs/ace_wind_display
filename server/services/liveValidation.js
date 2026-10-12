import { normaliseTimestamp,validNumber,isGoodQuality } from '../history/telemetry.js';
const fields = [
  ['activePowerKw','wec_active_power',-1000,6500],['windSpeed','wec_wind_speed',0,100],
  ['rotorRpm','wec_rotor_speed',0,30],['nacelleDeg','wec_nacelle_position',0,360],
  ['lifetimeEnergyKwh','wec_energy_exported',0,Infinity],
  ['aggregateWindDir','aggregate_wind_direction',0,360],
  ['availablePowerAfterSetpoints','aggregate_available_power_after_external_setpoints',0,6500],
  ['theoreticalMaxPower','aggregate_theoretical_maximum_active_power',0,6500],
];
export function validateLiveNow(site,wec,previous,clock=Date.now()) {
  const snapshot={...previous}; const observed=[];
  for (const [name,field,min,max] of fields) {
    const data=field.startsWith('wec_') ? wec : site;
    const series=data?.series?.[field]; const times=data?.timestamps;
    if (!Array.isArray(series) || !Array.isArray(times) || series.length!==times.length || !times.length) throw new Error(`Missing live field: ${field}`);
    const ts=Date.parse(normaliseTimestamp(times.at(-1)));
    if (clock-ts>30000 || ts-clock>60000 || (data.quality && !isGoodQuality(data.quality.at(-1)))) throw new Error('Live observation is stale or invalid');
    const value=series.at(-1);
    if (!validNumber(value,min,max)) throw new Error(`Invalid live field: ${field}`);
    snapshot[name]=value; observed.push(ts);
  }
  const hours=wec.series?.wec_operating_hours?.at(-1);
  if (validNumber(hours,0)) snapshot.operatingHours=hours;
  return {now:snapshot,observedAt:new Date(Math.min(...observed)).toISOString()};
}
export function validateStatus(values) {
  if (!values || !Number.isInteger(values.main_status) || ![0,1].includes(values.fault_message_flag) || ![0,1].includes(values.service_flag)) throw new Error('Invalid status event');
  return values;
}
