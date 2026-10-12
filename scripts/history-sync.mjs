import '../server/config/env.js';
import {syncHistory} from '../server/history/worker.js';
import {pool} from '../server/db/timescaleDb.js';
try {
  const result=await syncHistory();
  console.log(JSON.stringify(result));
  if(result.ok===false)process.exitCode=1;
} finally {await pool.end();}
