import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
test('legacy SQLite assigns London dates at DST boundaries',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'windmill-sqlite-'));
  process.env.SQLITE_PATH=path.join(directory,'test.db');
  const {default:db,getDailyRollups}=await import('./sqliteDb.js');
  try {
    const insert=db.prepare('INSERT INTO scada_10m(timestamp,energy_produced,source) VALUES (?,?,?)');
    for (const [i,ts] of ['2026-10-24T22:50:00Z','2026-10-24T23:00:00Z','2026-10-25T23:50:00Z','2026-10-26T00:00:00Z'].entries())insert.run(ts,100+i,'live_sync');
    const days=getDailyRollups();
    assert.deepEqual(days.map(d=>[d.date_london,d.sample_count]),[['2026-10-26',1],['2026-10-25',2],['2026-10-24',1]]);
  } finally {
    db.close();
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));
    await fs.rm(directory,{recursive:true,force:true});
  }
});
