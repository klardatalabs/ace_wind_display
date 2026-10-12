import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLiveNow,validateStatus} from './liveValidation.js';
test('live validation rejects missing, stale and bad values without changing previous state',()=>{
  const clock=Date.parse('2026-10-12T12:00:00Z');
  const site={timestamps:[clock*1000],series:{aggregate_wind_direction:[210],aggregate_available_power_after_external_setpoints:[4200],aggregate_theoretical_maximum_active_power:[4245]}};
  const wec={timestamps:[clock*1000],series:{wec_active_power:[0],wec_wind_speed:[4],wec_rotor_speed:[6],wec_nacelle_position:[215],wec_energy_exported:[100]}};
  assert.equal(validateLiveNow(site,wec,{},clock).now.activePowerKw,0);
  assert.throws(()=>validateLiveNow(site,wec,{},clock+31000));
  wec.series.wec_wind_speed=[NaN];
  const previous={windSpeed:4};
  assert.throws(()=>validateLiveNow(site,wec,previous,clock));
  assert.deepEqual(previous,{windSpeed:4});
  assert.throws(()=>validateStatus({main_status:0,fault_message_flag:9,service_flag:0}));
});
