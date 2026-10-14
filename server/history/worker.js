import {getApiStatus,getWecStdPages} from '../clients/aceClient.js';
import {historyConfig} from './config.js';
import {HISTORY_FIELDS,normaliseHistoryPage,normaliseTimestamp,TEN_MINUTES} from './telemetry.js';
import {withHistoryLock,upsertLive,refreshHistory,publishHistoryStatus} from './database.js';
import {readReceipt,writeReceipt} from './receipts.js';
import {checkZenodoRelease} from './zenodo.js';

export async function syncWindow(client,start,end) {
  let changed=0; let fetched=0; let rejected=0;
  for await (const page of getWecStdPages(HISTORY_FIELDS,{start,end,resolution:'10m',pageSize:5000})) {
    const parsed=normaliseHistoryPage(page,historyConfig.asset);
    const records=parsed.records.filter(r=>Date.parse(r.observed_at_utc)>=Date.parse(start) && Date.parse(r.observed_at_utc)<Date.parse(end));
    fetched+=page.timestamps.length; rejected+=parsed.rejected;
    changed+=await upsertLive(client,records);
  }
  // A prior attempt may have committed rows before its aggregate refresh failed.
  await refreshHistory(client,start,end);
  return {changed,fetched,rejected};
}
export async function syncHistory() {
  const receipt=await readReceipt('api-sync');
  const attemptedAt=new Date().toISOString();
  try {
    return await withHistoryLock(async client=>{
      const status=await getApiStatus();
      const available=status.data_windows?.find(w=>w.family==='wecstd' && w.resolution==='10m');
      if (!available?.start || !available.end) throw new Error('API did not report its 10-minute window');
      const availableStart=normaliseTimestamp(available.start,true);
      const availableEnd=normaliseTimestamp(available.end,true);
      const end=Math.min(Math.floor(Date.now()/TEN_MINUTES)*TEN_MINUTES,Date.parse(availableEnd)+TEN_MINUTES);
      let cursor=Math.max(Date.parse(availableStart),Date.parse(historyConfig.start),receipt.checkpoint ? Date.parse(receipt.checkpoint)-historyConfig.lookbackMs : Date.parse(historyConfig.start));
      let result={...receipt,attemptedAt,availableStart,availableEnd,changed:0,fetched:0,rejected:0};
      delete result.error;
      while (cursor<end) {
        const next=Math.min(end,cursor+7*86400000);
        const counts=await syncWindow(client,new Date(cursor).toISOString(),new Date(next).toISOString());
        for (const key of ['changed','fetched','rejected']) result[key]+=counts[key];
        result={...result,checkpoint:new Date(next).toISOString(),lastSuccessAt:new Date().toISOString(),ok:true};
        await writeReceipt('api-sync',result); cursor=next;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      if (!receipt.repairedAt || Date.now()-Date.parse(receipt.repairedAt)>86400000) {
        const {rows}=await client.query(`WITH holes AS (
          SELECT t,t-ROW_NUMBER() OVER(ORDER BY t)*INTERVAL '10 minutes' AS grp
          FROM generate_series($1::timestamptz,$2::timestamptz-INTERVAL '10 minutes',INTERVAL '10 minutes') t
          LEFT JOIN history.scada_10m s ON s.asset_id=$3 AND s.observed_at_utc=t
          WHERE s.observed_at_utc IS NULL OR s.quality='partial'
        ) SELECT MIN(t) AS start,MAX(t)+INTERVAL '10 minutes' AS finish FROM holes GROUP BY grp ORDER BY start`,[availableStart,new Date(end).toISOString(),historyConfig.asset]);
        for (const gap of rows) {
          for (let from=new Date(gap.start).getTime();from<new Date(gap.finish).getTime();from+=7*86400000) {
            const counts=await syncWindow(client,new Date(from).toISOString(),new Date(Math.min(from+7*86400000,new Date(gap.finish).getTime())).toISOString());
            for (const key of ['changed','fetched','rejected']) result[key]+=counts[key];
            await new Promise(resolve=>setTimeout(resolve,100));
          }
        }
        result.repairedAt=new Date().toISOString();
      }
      result={...result,ok:true,lastSuccessAt:new Date().toISOString()};
      await publishHistoryStatus(client,'api-sync',result);
      await writeReceipt('api-sync',result); return result;
    });
  } catch(err) {
    const latest=await readReceipt('api-sync');
    await writeReceipt('api-sync',{...latest,attemptedAt,ok:false,error:'API sync failed; see server log'});
    await withHistoryLock(client=>publishHistoryStatus(client,'api-sync',{...latest,attemptedAt,ok:false,error:'API sync failed; see server log'})).catch(()=>{});
    console.warn('[History] API sync failed:',err.message);
    return {ok:false};
  }
}
export function startHistoryWorker() {
  let stopped=false; let timer;
  const loop=async()=>{
    try {
      await syncHistory();
      const release=await readReceipt('zenodo');
      if (!release.checkedAt || Date.now()-Date.parse(release.checkedAt)>86400000) await checkZenodoRelease();
    } catch(err) {console.warn('[History] Worker failed:',err.message);}
    if (!stopped) timer=setTimeout(loop,historyConfig.intervalMs);
  };
  void loop();
  return ()=>{stopped=true;clearTimeout(timer);};
}
