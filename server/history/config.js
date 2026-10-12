import path from 'node:path';
function positive(name,fallback) {
  const value=Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value<=0) throw new Error(`Invalid ${name}`);
  return value;
}
export const historyConfig={
  backend:process.env.HISTORY_BACKEND || 'legacy',
  asset:process.env.HISTORY_ASSET || 'wec-1',
  start:process.env.HISTORY_START || '2026-07-21T10:40:00Z',
  intervalMs:positive('HISTORY_SYNC_MS',600000),
  lookbackMs:positive('HISTORY_LOOKBACK_HOURS',24)*3600000,
  staleMs:positive('HISTORY_STALE_MINUTES',30)*60000,
  operations:path.resolve(process.env.HISTORY_OPERATIONS_DIR || path.join(process.env.DATA_DIR || 'data','operations')),
  archive:path.resolve(process.env.ZENODO_DIR || path.join(process.env.DATA_DIR || 'data','zenodo')),
};
if (!['legacy','timescale'].includes(historyConfig.backend)) throw new Error('HISTORY_BACKEND must be legacy or timescale');
if (!Number.isFinite(Date.parse(historyConfig.start))) throw new Error('Invalid HISTORY_START');
if (!/^[a-zA-Z0-9_-]+$/.test(historyConfig.asset)) throw new Error('Invalid HISTORY_ASSET');
export const canonicalHistory=historyConfig.backend==='timescale';
