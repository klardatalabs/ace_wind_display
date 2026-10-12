import {pool} from '../db/timescaleDb.js';
import {historyConfig} from './config.js';
import {VALUE_COLUMNS,TEN_MINUTES} from './telemetry.js';
import {readReceipt} from './receipts.js';
import {londonDate,londonDayStart} from '../../shared/time.js';

export async function withHistoryLock(work,key=877001) {
  const client=await pool.connect();
  try {
    const {rows}=await client.query('SELECT pg_try_advisory_lock($1) AS locked',[key]);
    if (!rows[0].locked) return {skipped:true};
    try {return await work(client);} finally {await client.query('SELECT pg_advisory_unlock($1)',[key]);}
  } finally {client.release();}
}
export async function publishHistoryStatus(client,name,receipt) {
  const {rows}=await client.query("SELECT format('COMMENT ON TABLE history.scada_10m IS %L',(COALESCE(obj_description('history.scada_10m'::regclass),'{}')::jsonb || jsonb_build_object($1::text,$2::jsonb))::text) AS ddl",[name,JSON.stringify(receipt)]);
  await client.query(rows[0].ddl);
}
export async function upsertLive(client,records) {
  if (!records.length) return 0;
  const declarations=VALUE_COLUMNS.map(c=>`${c} double precision`).join(',');
  const merged=VALUE_COLUMNS.map(c=>`COALESCE(EXCLUDED.${c},stored.${c})`);
  const quality=`CASE WHEN ${merged.map(c=>`${c} IS NOT NULL`).join(' AND ')} THEN 'complete' ELSE 'partial' END`;
  const {rowCount}=await client.query(`
    INSERT INTO history.scada_10m AS stored (asset_id,observed_at_utc,${VALUE_COLUMNS.join(',')},source,source_release,quality)
    SELECT asset_id,observed_at_utc,${VALUE_COLUMNS.join(',')},'live',NULL,quality
    FROM jsonb_to_recordset($1::jsonb) AS x(asset_id text,observed_at_utc timestamptz,${declarations},quality text)
    ON CONFLICT (asset_id,observed_at_utc) DO UPDATE SET
      ${VALUE_COLUMNS.map((c,i)=>`${c}=${merged[i]}`).join(',')},
      source='live',source_release=NULL,
      quality=${quality},
      ingested_at=NOW()
    WHERE (stored.${VALUE_COLUMNS.join(',stored.')},stored.source,stored.quality) IS DISTINCT FROM (${merged.join(',')},'live',${quality})
      AND (${merged[0]} IS NULL OR ${merged[1]} IS NULL OR ${merged[1]}>=${merged[0]})
      AND (${merged[2]} IS NULL OR ${merged[3]} IS NULL OR ${merged[3]}>=${merged[2]})`,[JSON.stringify(records)]);
  return rowCount;
}
export async function refreshHistory(client,start,end) {
  const from=londonDayStart(new Date(Date.parse(start)-86400000)).toISOString();
  const to=londonDayStart(new Date(Date.parse(end)+2*86400000)).toISOString();
  await client.query("CALL refresh_continuous_aggregate('history.daily_base',$1::timestamptz,$2::timestamptz)",[from,to]);
}
export async function getDailyRollups(limit=30) {
  const {rows}=await pool.query(`SELECT *,active_power_max AS active_power_peak FROM history.daily_rollup WHERE asset_id=$1 AND date_london>=TO_CHAR((NOW() AT TIME ZONE 'Europe/London')::date-($2::integer-1),'YYYY-MM-DD') ORDER BY bucket DESC`,[historyConfig.asset,limit]);
  if(!rows.length)return [];
  const stale=Date.now()-new Date(rows[0].end_utc).getTime()>historyConfig.staleMs;
  const byDate=new Map(rows.map(r=>[r.date_london,{...r,sample_count:Number(r.sample_count),coverage_pct:Number(r.coverage_pct),history_stale:stale}]));
  const today=new Date(`${londonDate()}T12:00:00Z`);
  return Array.from({length:limit},(_,i)=>{
    const date=new Date(today.getTime()-i*86400000).toISOString().slice(0,10);
    return byDate.get(date) || {date_london:date,energy_kwh:null,sample_count:0,coverage_pct:0,history_stale:stale,energy_method:'estimated from 10-minute mean net power'};
  });
}
export async function getHistoryRange(hours=24) {
  const daily=hours>48;
  const {rows}=await pool.query(daily ? `SELECT bucket AS ts,wind_speed_avg AS wind,active_power_avg AS power FROM history.daily_rollup WHERE asset_id=$1 AND bucket>=NOW()-$2::double precision*INTERVAL '1 hour' ORDER BY bucket` :
    `SELECT observed_at_utc AS ts,wind_speed_mean_ms AS wind,active_power_mean_kw AS power FROM history.scada_10m WHERE asset_id=$1 AND observed_at_utc>=NOW()-$2::double precision*INTERVAL '1 hour' ORDER BY observed_at_utc`,[historyConfig.asset,hours]);
  return {timestamps:rows.map(r=>new Date(r.ts).getTime()*1000),wind:rows.map(r=>r.wind),power:rows.map(r=>r.power)};
}
export async function getTodaySummary() {
  const {rows}=await pool.query(`SELECT SUM(active_power_mean_kw)/6 AS energy,AVG(wind_speed_mean_ms) AS wind,MAX(observed_at_utc) AS latest,COUNT(active_power_mean_kw)::integer AS count FROM history.scada_10m WHERE asset_id=$1 AND observed_at_utc>=$2`,[historyConfig.asset,londonDayStart().toISOString()]);
  if (!rows[0].count) throw new Error('No stored observations today');
  return {energyKwh:rows[0].energy,avgWindSpeed:rows[0].wind,observedAt:rows[0].latest,energyMethod:'estimated from 10-minute mean net power',stale:Date.now()-new Date(rows[0].latest).getTime()>historyConfig.staleMs};
}
export async function getHistoryHealth() {
  const [sync,release,backup]=await Promise.all([readReceipt('api-sync'),readReceipt('zenodo'),readReceipt('backup')]);
  try {
    const {rows}=await pool.query(`SELECT MIN(observed_at_utc) AS first,MAX(observed_at_utc) AS latest,COUNT(*)::integer AS rows,COUNT(*) FILTER(WHERE quality='partial')::integer AS partial,hypertable_size('history.scada_10m') AS bytes FROM history.scada_10m WHERE asset_id=$1`,[historyConfig.asset]);
    const r=rows[0]; const lag=r.latest ? Math.max(0,Date.now()-new Date(r.latest).getTime()) : null;
    const expected=r.first ? (new Date(r.latest)-new Date(r.first))/TEN_MINUTES+1 : 0;
    const resets=await pool.query(`SELECT COUNT(*)::integer AS n FROM (SELECT energy_meter_kwh,LAG(energy_meter_kwh) OVER(ORDER BY observed_at_utc) AS previous FROM history.scada_10m WHERE asset_id=$1 AND energy_meter_kwh IS NOT NULL) meters WHERE energy_meter_kwh<previous`,[historyConfig.asset]);
    return {databaseAvailable:true,asset:historyConfig.asset,...r,meterResets:resets.rows[0].n,complete:r.rows-r.partial,gaps:Math.max(0,expected-r.rows),lagSeconds:lag===null?null:Math.round(lag/1000),stale:lag===null || lag>historyConfig.staleMs,sync,release,backup};
  } catch {return {databaseAvailable:false,stale:true,sync,release,backup};}
}
export async function getPast24Hours() {
  const {rows}=await pool.query(`SELECT SUM(active_power_mean_kw)/6 AS energy_kwh,AVG(active_power_mean_kw) AS avg_power_kw,MAX(active_power_max_kw) AS max_power_kw,AVG(wind_speed_mean_ms) AS avg_wind_ms,MAX(wind_speed_max_ms) AS max_wind_ms,COUNT(active_power_mean_kw)::integer AS sample_count,MAX(observed_at_utc) AS latest FROM history.scada_10m WHERE asset_id=$1 AND observed_at_utc>=NOW()-INTERVAL '24 hours' AND observed_at_utc<NOW()`,[historyConfig.asset]);
  const r=rows[0];
  return r.sample_count ? {period:'past 24 hours',...r,capacity_factor_pct:r.energy_kwh/(4245*24)*100,coverage_pct:r.sample_count/144*100,energy_method:'estimated from 10-minute mean net power'} : {message:'No stored observations in the past 24 hours.'};
}
export async function getSingleDay(date) {
  const parsed=new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(parsed.getTime()) || londonDate(parsed)!==date) return {error:'date must be a valid YYYY-MM-DD'};
  const {rows}=await pool.query(`SELECT bucket AS day,energy_kwh,active_power_avg AS avg_power_kw,active_power_max AS max_power_kw,wind_speed_avg AS avg_wind_ms,wind_speed_max AS max_wind_ms,coverage_pct,energy_method FROM history.daily_rollup WHERE asset_id=$1 AND date_london=$2`,[historyConfig.asset,date]);
  return rows[0] || {message:`No stored generation data for ${date}.`};
}
