import {once} from 'node:events';
import {pool} from '../db/timescaleDb.js';
import {historyConfig} from './config.js';
import {HISTORY_COLUMNS,normaliseTimestamp} from './telemetry.js';
import {ATTRIBUTION_TEXT,LICENSE_URL} from '../../shared/constants.js';
let active=0;
export function csvCell(value) {
  if(value===null || value===undefined)return '';
  const text=value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text;
}
export async function streamHistoryCsv(req,res,database=pool) {
  let start,end;
  try {
    if(req.query.format && req.query.format!=='csv')throw new Error('Only CSV format is supported');
    if(req.query.asset && req.query.asset!==historyConfig.asset)throw new Error('Unknown asset');
    start=req.query.start ? normaliseTimestamp(req.query.start) : '-infinity';
    end=req.query.end ? normaliseTimestamp(req.query.end) : 'infinity';
    if(start!=='-infinity' && end!=='infinity' && Date.parse(start)>=Date.parse(end))throw new Error('start must precede end');
  } catch(err){return res.status(400).json({error:err.message});}
  if(active>=2)return res.status(429).json({error:'Two history exports are already running'});
  active++;
  const abort=new AbortController();
  const closed=()=>{if(!res.writableFinished)abort.abort();};
  res.on('close',closed); let client;
  const write=async text=>{
    if(abort.signal.aborted)throw new Error('Export disconnected');
    if(!res.write(text))await once(res,'drain',{signal:abort.signal});
  };
  try {
    client=await database.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout='15s'");
    let after=null;
    do {
      const {rows}=await client.query(`SELECT ${HISTORY_COLUMNS.join(',')} FROM history.scada_10m WHERE asset_id=$1 AND observed_at_utc>=$2::timestamptz AND observed_at_utc<$3::timestamptz AND ($4::timestamptz IS NULL OR observed_at_utc>$4) ORDER BY observed_at_utc LIMIT 5000`,[historyConfig.asset,start,end,after]);
      if(!res.headersSent) {
        res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="weston-wind-history.csv"','X-Attribution':ATTRIBUTION_TEXT,'X-License':LICENSE_URL});
        await write(HISTORY_COLUMNS.join(',')+'\r\n');
      }
      for(const row of rows)await write(HISTORY_COLUMNS.map(c=>csvCell(row[c])).join(',')+'\r\n');
      if(rows.length<5000)break;
      after=rows.at(-1).observed_at_utc;
    } while(!abort.signal.aborted);
    if(abort.signal.aborted)throw new Error('Export disconnected');
    await client.query('COMMIT'); res.end();
  } catch(err) {
    if(client)await client.query('ROLLBACK').catch(()=>{});
    if(!res.headersSent && !abort.signal.aborted)res.status(503).json({error:'Historical database unavailable'});
    else if(!res.writableFinished)res.destroy();
  } finally {res.off('close',closed);client?.release();active--;}
}
