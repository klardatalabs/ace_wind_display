import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createServer} from 'node:http';
import {csvCell,streamHistoryCsv} from './export.js';
import {pool} from '../db/timescaleDb.js';
after(()=>pool.end());
test('CSV preserves nulls, UTC and quoting',()=>{
  assert.equal(csvCell(null),''); assert.equal(csvCell('a,"b"'),'"a,""b"""');
  assert.equal(csvCell(new Date('2026-10-01T00:00:00Z')),'2026-10-01T00:00:00.000Z');
});
test('CSV export validates bounds, streams one snapshot and releases on DB failure',async()=>{
  const calls=[];let released=0;let failed=false;
  const database={connect:async()=>({query:async(sql)=>{
    calls.push(sql);
    if(sql.startsWith('SELECT')) {
      if(failed)throw new Error('offline');
      return {rows:[{asset_id:'wec-1',observed_at_utc:new Date('2026-10-01T00:00:00Z'),active_power_mean_kw:0,source:'live',quality:'partial'}]};
    }
    return {rows:[]};
  },release:()=>released++})};
  const app=express();app.get('/export',(req,res)=>streamHistoryCsv(req,res,database));
  const server=createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/export`;
  try {
    assert.equal((await fetch(url+'?start=bad')).status,400);
    let response=await fetch(url);assert.equal(response.status,200);
    assert.match(await response.text(),/2026-10-01T00:00:00.000Z/);
    assert.match(calls[0],/REPEATABLE READ READ ONLY/);assert.ok(calls.includes('COMMIT'));assert.equal(released,1);
    failed=true;response=await fetch(url);assert.equal(response.status,503);assert.ok(calls.includes('ROLLBACK'));assert.equal(released,2);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
test('client cancellation rolls back the export and releases its connection',async()=>{
  let released; const release=new Promise(resolve=>{released=resolve;});
  const calls=[];
  const rows=Array.from({length:5000},(_,i)=>({asset_id:'wec-1',observed_at_utc:new Date(1790812200000+i*600000),active_power_mean_kw:0}));
  const database={connect:async()=>({query:async sql=>{calls.push(sql);if(sql.startsWith('SELECT')){await new Promise(resolve=>setTimeout(resolve,20));return {rows};}return {rows:[]};},release:released})};
  const app=express();app.get('/export',(req,res)=>streamHistoryCsv(req,res,database));
  const server=createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/export`);
    const reader=response.body.getReader();await reader.read();await reader.cancel();
    await Promise.race([release,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Export leaked connection')),2000))]);
    assert.ok(calls.includes('ROLLBACK'));
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
