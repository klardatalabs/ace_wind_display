export const TEN_MINUTES = 600_000;
export const HISTORY_FIELDS = ['wind_speed_mean','wind_speed_max','active_power_mean','active_power_max','energy_produced'];
export const VALUE_COLUMNS = ['wind_speed_mean_ms','wind_speed_max_ms','active_power_mean_kw','active_power_max_kw','energy_meter_kwh'];
export const HISTORY_COLUMNS = ['asset_id','observed_at_utc',...VALUE_COLUMNS,'source','source_release','quality','ingested_at'];

export function normaliseTimestamp(raw, tenMinute = false) {
  if (typeof raw === 'string' && !/(Z|[+-]\d{2}:\d{2})$/.test(raw)) throw new Error('Timestamp must include UTC offset');
  if (typeof raw === 'number' && (!Number.isSafeInteger(raw) || raw < 1e12)) throw new Error('Invalid epoch timestamp');
  const ms=typeof raw==='number' && raw>1e14 ? raw/1000 : typeof raw==='number' ? raw : Date.parse(raw);
  if (!Number.isFinite(ms) || (tenMinute && ms%TEN_MINUTES)) throw new Error('Invalid or unaligned timestamp');
  return new Date(ms).toISOString();
}
export function validNumber(value,min=-Infinity,max=Infinity) {
  return typeof value==='number' && Number.isFinite(value) && value>=min && value<=max;
}
export function normaliseHistoryPage(page,asset=process.env.HISTORY_ASSET || 'wec-1') {
  if (!Array.isArray(page?.timestamps) || !page.series || (page.asset && page.asset!==asset)) throw new Error('Invalid history response');
  for (const field of HISTORY_FIELDS) {
    if (page.series[field]!==undefined && (!Array.isArray(page.series[field]) || page.series[field].length!==page.timestamps.length)) throw new Error(`Misaligned series: ${field}`);
  }
  if (page.quality && (!Array.isArray(page.quality) || page.quality.length!==page.timestamps.length)) throw new Error('Misaligned quality');
  const records=[]; let rejected=0;
  for (let i=0;i<page.timestamps.length;i++) {
    if (page.quality && page.quality[i]!=='good') { rejected++; continue; }
    let ts;
    try { ts=normaliseTimestamp(page.timestamps[i],true); } catch { rejected++; continue; }
    const values=HISTORY_FIELDS.map((f,j)=>{
      const v=page.series[f]?.[i];
      return validNumber(v,j<2 || j===4 ? 0 : -1000,j<2 ? 100 : j===4 ? Infinity : 6500) ? v : null;
    });
    if (values[0]!==null && values[1]!==null && values[1]<values[0]) values[1]=null;
    if (values[2]!==null && values[3]!==null && values[3]<values[2]) values[3]=null;
    if (values.every(v=>v===null)) { rejected++; continue; }
    records.push({asset_id:asset,observed_at_utc:ts,...Object.fromEntries(VALUE_COLUMNS.map((c,j)=>[c,values[j]])),source:'live',source_release:null,
      quality:values.every(v=>v!==null) && (!page.quality || page.quality[i]==='good') ? 'complete' : 'partial'});
  }
  return {records,rejected};
}
