import '../server/config/env.js';
import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import path from 'node:path';
import {normaliseTimestamp} from '../server/history/telemetry.js';

const databasePath=process.env.SQLITE_PATH || path.join(process.env.DATA_DIR || 'data','ace_history.db');
const operations=process.env.HISTORY_OPERATIONS_DIR || path.join(process.env.DATA_DIR || 'data','operations');
const db=new Database(databasePath,{fileMustExist:true});
try {
  const groups=new Map();
  for (const row of db.prepare('SELECT * FROM scada_10m').all()) {
    const key=normaliseTimestamp(row.timestamp,true);
    const group=groups.get(key) || []; group.push(row); groups.set(key,group);
  }
  const changes=[...groups].filter(([key,rows])=>rows.length>1 || rows[0].timestamp!==key);
  if (!changes.length) { console.log('SQLite timestamps already normalized.'); }
  else {
    await fs.mkdir(operations,{recursive:true});
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const backup=path.join(operations,`sqlite-before-normalise-${stamp}.db`);
    await db.backup(backup);
    const columns=Object.keys(changes[0][1][0]);
    const insert=db.prepare(`INSERT INTO scada_10m (${columns.join(',')}) VALUES (${columns.map(c=>'@'+c).join(',')})`);
    const remove=db.prepare('DELETE FROM scada_10m WHERE timestamp=?');
    const report={backup,duplicates:changes.filter(([,rows])=>rows.length>1),before:db.prepare('SELECT COUNT(*) n FROM scada_10m').get().n};
    // Write the recovery report before changing the database.
    await fs.writeFile(path.join(operations,`sqlite-normalise-${stamp}.json`),JSON.stringify(report,null,2));
    db.transaction(()=>{
      for (const [key,rows] of changes) {
        const winner=rows.find(r=>['live','live_sync'].includes(r.source)) || rows[0];
        for (const row of rows) remove.run(row.timestamp);
        insert.run({...winner,timestamp:key});
      }
    })();
    console.log(JSON.stringify({before:report.before,after:db.prepare('SELECT COUNT(*) n FROM scada_10m').get().n,backup,merged:report.duplicates.length}));
  }
} finally { db.close(); }
