import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {pollNowOnce,pollStatusOnce,getState} from './turbineState.js';
import {pollTodayOnce} from './turbineState.js';
import {pool} from '../db/timescaleDb.js';
import {run as liveStatus} from '../chat/tools/liveStatus.js';
import {respondWithoutLlm} from '../chat/fallbackResponder.js';
import {redis} from '../db/redisClient.js';
after(async()=>{redis?.disconnect();await pool.end();});

test('canonical today energy is identified as estimated in live and fallback chat',async()=>{
  const backend=process.env.HISTORY_BACKEND;const query=pool.query;
  process.env.HISTORY_BACKEND='timescale';
  pool.query=async()=>({rows:[{energy:600,wind:4,latest:new Date(),count:144}]});
  try {
    await pollTodayOnce();
    const status=await liveStatus();
    assert.equal(status.today_energy_kwh,600);
    assert.match(status.today_energy_method,/estimated/);
    assert.equal(status.today_data_stale,false);
    let text='';await respondWithoutLlm('How much energy today?',{onText:t=>{text+=t;}});
    assert.match(text,/estimated.*600/);
  } finally {pool.query=query;if(backend===undefined)delete process.env.HISTORY_BACKEND;else process.env.HISTORY_BACKEND=backend;}
});
test('successful status polls cannot hide failed current-value polls',async()=>{
  const original=globalThis.fetch;let bad=false;
  globalThis.fetch=async url=>{
    const site={aggregate_wind_direction:[210],aggregate_available_power_after_external_setpoints:[4200],aggregate_theoretical_maximum_active_power:[4245]};
    const wec={wec_active_power:[bad ? NaN : 200],wec_wind_speed:[4],wec_rotor_speed:[6],wec_nacelle_position:[215],wec_energy_exported:[100]};
    return new Response(JSON.stringify(String(url).includes('/events/') ? {events:[{values:{main_status:0,fault_message_flag:0,service_flag:0}}]} : {timestamps:[Date.now()*1000],series:String(url).includes('site_instantaneous') ? site : wec}));
  };
  try {
    await pollNowOnce();const before=getState();assert.equal(before.connected,true);
    bad=true;
    for(let i=0;i<3;i++){await pollNowOnce();await pollStatusOnce();}
    const after=getState();assert.equal(after.connected,false);assert.equal(after.liveAt,before.liveAt);assert.equal(after.now.activePowerKw,200);
  } finally {globalThis.fetch=original;}
});
