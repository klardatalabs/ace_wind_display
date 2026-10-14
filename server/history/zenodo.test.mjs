import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pool} from '../db/timescaleDb.js';
import {historyConfig} from './config.js';
import {readReceipt,writeReceipt} from './receipts.js';
import {checkZenodoRelease} from './zenodo.js';

test('verified unchanged release needs only ACE discovery; a failed new release keeps the prior import',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'wind-zenodo-'));
  const operations=historyConfig.operations,connect=pool.connect,fetch=globalThis.fetch;
  historyConfig.operations=directory;
  pool.connect=async()=>({query:async sql=>({rows:sql.includes('pg_try_advisory_lock') ? [{locked:true}] : sql.includes('AS ddl') ? [{ddl:'COMMENT ON TABLE history.scada_10m IS NULL'}] : []}),release(){}});
  let release='10.5281/zenodo.23114177';const requests=[];
  globalThis.fetch=async url=>{
    requests.push(String(url));
    return String(url).endsWith('/v1/status') ? new Response(JSON.stringify({zenodo:{status:'ok',record_doi:release}})) : new Response('Unavailable',{status:403});
  };
  try {
    await writeReceipt('zenodo',{release,ok:true,lastSuccessAt:'2026-10-12T12:00:00Z',report:{inserted:0}});
    assert.equal((await checkZenodoRelease()).ok,true);
    assert.equal(requests.length,1);
    assert.match(requests[0],/\/v1\/status$/);
    release='10.5281/zenodo.23114178';
    assert.equal((await checkZenodoRelease()).ok,false);
    const receipt=await readReceipt('zenodo');
    assert.equal(receipt.release,'10.5281/zenodo.23114177');
    assert.equal(receipt.lastSuccessAt,'2026-10-12T12:00:00Z');
    assert.equal(receipt.report.inserted,0);
  } finally {
    globalThis.fetch=fetch;pool.connect=connect;historyConfig.operations=operations;
    assert.equal(await fs.realpath(path.dirname(directory)),await fs.realpath(os.tmpdir()));
    await fs.rm(directory,{recursive:true,force:true});await pool.end();
  }
});
