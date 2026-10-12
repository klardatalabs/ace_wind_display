import '../server/config/env.js';
import {checkZenodoRelease} from '../server/history/zenodo.js';
import {pool} from '../server/db/timescaleDb.js';
try {
  const result=await checkZenodoRelease();
  console.log(JSON.stringify(result));
  if(result.ok===false)process.exitCode=1;
} finally {await pool.end();}
