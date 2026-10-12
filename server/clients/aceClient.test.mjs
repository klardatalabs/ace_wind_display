import test from 'node:test';
import assert from 'node:assert/strict';
import {getWecStdRangeAll} from './aceClient.js';
test('range pagination is sequential and rejects repeated cursors',async()=>{
  const original=globalThis.fetch; let calls=0;
  globalThis.fetch=async url=>{
    calls++; const cursor=new URL(url).searchParams.get('cursor');
    assert.equal(cursor,calls===1 ? null : 'second');
    return new Response(JSON.stringify({timestamps:[1790812200000000+(calls-1)*600000000],series:{active_power_mean:[calls]},page:{next_cursor:calls===1?'second':null,has_more:calls===1}}));
  };
  try {
    const page=await getWecStdRangeAll(['active_power_mean']);
    assert.deepEqual(page.series.active_power_mean,[1,2]); assert.equal(calls,2);
    calls=0;
    globalThis.fetch=async()=>new Response(JSON.stringify({timestamps:[1790812200000000+calls++*600000000],series:{active_power_mean:[1]},page:{next_cursor:'repeat',has_more:true}}));
    await assert.rejects(getWecStdRangeAll(['active_power_mean']),/Repeated/);
  } finally {globalThis.fetch=original;}
});
