import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pool,getTimescaleRecords,getTimescalePowerCurve,getTimescaleComparisonMetrics} from '../db/timescaleDb.js';
import {upsertLive,refreshHistory,getSingleDay,withHistoryLock} from './database.js';
import {syncHistory} from './worker.js';
import {readReceipt} from './receipts.js';
import {historyConfig} from './config.js';
import os from 'node:os';
import path from 'node:path';
import {pollTodayOnce,pollNowOnce,getState} from '../services/turbineState.js';
const enabled=process.env.HISTORY_TEST_DB==='1';
if(enabled && (!process.env.PGDATABASE?.endsWith('_test') || process.env.PGPORT!=='55433' || process.env.HISTORY_BACKEND!=='timescale'))throw new Error('Integration tests require the isolated _test database on port 55433');
let temporaryOperations;
after(async()=>{
  await pool.end();
  if(temporaryOperations) {
    assert.equal((await fs.realpath(path.dirname(temporaryOperations))).toLowerCase(),(await fs.realpath(os.tmpdir())).toLowerCase());
    await fs.rm(temporaryOperations,{recursive:true,force:true});
  }
});
test('Timescale migration, DST, API precedence, correction/replay and legacy adapters',{skip:!enabled},async()=>{
  await pool.query('CREATE EXTENSION IF NOT EXISTS timescaledb');
  await pool.query('DROP SCHEMA IF EXISTS history CASCADE');
  await pool.query(await fs.readFile(new URL('../../scripts/migrate_history.sql',import.meta.url),'utf8'));
  temporaryOperations=await fs.mkdtemp(path.join(os.tmpdir(),'windmill-history-'));
  historyConfig.operations=temporaryOperations;
  for(const [start,end] of [['2026-10-24T23:00:00Z','2026-10-26T00:00:00Z'],['2026-03-29T00:00:00Z','2026-03-29T23:00:00Z']]) {
    await pool.query(`INSERT INTO history.scada_10m (asset_id,observed_at_utc,wind_speed_mean_ms,wind_speed_max_ms,active_power_mean_kw,active_power_max_kw,energy_meter_kwh,source,source_release,quality)
    SELECT 'wec-1',t,4,5,600,800,100,'zenodo','10.5281/zenodo.23114177','complete'
    FROM generate_series($1::timestamptz,$2::timestamptz-INTERVAL '10 minutes',INTERVAL '10 minutes') t`,[start,end]);
  }
  const client=await pool.connect();
  try {
    await refreshHistory(client,'2026-03-29T00:00:00Z','2026-10-26T00:00:00Z');
    const fall=await getSingleDay('2026-10-25'); const spring=await getSingleDay('2026-03-29');
    assert.equal(Number(fall.coverage_pct),100); assert.equal(fall.energy_kwh,15000);
    assert.equal(Number(spring.coverage_pct),100); assert.equal(spring.energy_kwh,13800);
    const record={asset_id:'wec-1',observed_at_utc:'2026-10-24T23:00:00Z',wind_speed_mean_ms:4,wind_speed_max_ms:5,active_power_mean_kw:0,active_power_max_kw:800,energy_meter_kwh:101,quality:'complete'};
    assert.equal(await upsertLive(client,[record]),1);
    assert.equal(await upsertLive(client,[record]),0);
    assert.equal(await upsertLive(client,[{...record,energy_meter_kwh:null,quality:'partial'}]),0);
    let result=await client.query('SELECT source,energy_meter_kwh FROM history.scada_10m WHERE observed_at_utc=$1',[record.observed_at_utc]);
    assert.equal(result.rows[0].source,'live');assert.equal(result.rows[0].energy_meter_kwh,101);
    record.active_power_mean_kw=700;
    assert.equal(await upsertLive(client,[record]),1);
    await refreshHistory(client,record.observed_at_utc,'2026-10-26T00:00:00Z');
    assert.ok(Math.abs((await getSingleDay('2026-10-25')).energy_kwh-(15000+100/6))<1e-8);
    const records=await getTimescaleRecords();
    assert.ok(records.peak_power);
    assert.equal(records.highest_daily_energy.date,'2026-10-25');
    assert.ok((await getTimescalePowerCurve()).empirical.length);
    assert.ok((await getTimescaleComparisonMetrics({mode:'zenodo_vs_live'})).sources.some(r=>r.source==='live'));
    assert.equal((await client.query("SELECT COUNT(*)::integer AS n FROM information_schema.columns WHERE table_schema='history' AND table_name='scada_10m'")).rows[0].n,11);
    const dashboard=JSON.parse(await fs.readFile(new URL('../../grafana/dashboards/history.json',import.meta.url),'utf8'));
    for(const window of ['week','month','all'])for(const panel of dashboard.panels)for(const target of panel.targets || []) {
      const sql=target.rawSql.replaceAll('${window:sqlstring}',`'${window}'`).replaceAll('${asset:sqlstring}',"'wec-1'");
      await client.query(sql);
    }
    await withHistoryLock(async()=>assert.deepEqual(await withHistoryLock(()=>assert.fail('Duplicate worker entered')),{skipped:true}));
    const originalFetch=globalThis.fetch;
    const start=Math.floor(Date.now()/600000)*600000-3600000;
    const latest=start+5*600000;
    let broken=false;
    globalThis.fetch=async url=>{
      if(String(url).endsWith('/v1/status'))return new Response(JSON.stringify({data_windows:[{family:'wecstd',resolution:'10m',start:new Date(start).toISOString(),end:new Date(latest).toISOString()}]}));
      if(broken)return new Response(JSON.stringify({timestamps:[start*1000],series:{wind_speed_mean:[]}}));
      const timestamps=Array.from({length:6},(_,i)=>(start+i*600000)*1000);
      const series=Object.fromEntries(['wind_speed_mean','wind_speed_max','active_power_mean','active_power_max','energy_produced'].map((f,i)=>[f,timestamps.map(()=>[4,5,600,800,100][i])]));
      return new Response(JSON.stringify({timestamps,series,page:{has_more:false,next_cursor:null}}));
    };
    try {
      const synced=await syncHistory();assert.equal(synced.ok,true);assert.equal(synced.fetched,6);
      const checkpoint=(await readReceipt('api-sync')).checkpoint;
      broken=true;assert.equal((await syncHistory()).ok,false);
      assert.equal((await readReceipt('api-sync')).checkpoint,checkpoint,'Failed pages must not advance checkpoint');
    } finally {globalThis.fetch=originalFetch;}
    const originalQuery=pool.query;
    globalThis.fetch=async url=>new Response(JSON.stringify({timestamps:[Date.now()*1000],series:String(url).includes('site_instantaneous') ?
      {aggregate_wind_direction:[210],aggregate_available_power_after_external_setpoints:[4200],aggregate_theoretical_maximum_active_power:[4245]} :
      {wec_active_power:[200],wec_wind_speed:[4],wec_rotor_speed:[6],wec_nacelle_position:[215],wec_energy_exported:[100]}}));
    pool.query=async()=>{throw new Error('Simulated historical DB outage');};
    try {
      await pollTodayOnce();await pollNowOnce();
      assert.equal(getState().freshness.today.failures,1);
      assert.equal(getState().connected,true,'DB-down history must not stop live observations');
    } finally {pool.query=originalQuery;globalThis.fetch=originalFetch;}
  } finally {client.release();}
});
