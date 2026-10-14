import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {createReadStream,createWriteStream} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {getApiStatus} from '../clients/aceClient.js';
import {historyConfig} from './config.js';
import {readReceipt,writeReceipt} from './receipts.js';
import {withHistoryLock,publishHistoryStatus} from './database.js';

export function importArchive(file,release,extra=[]) {
  return new Promise((resolve,reject)=>{
    const script=fileURLToPath(new URL('../../scripts/ingest_zenodo_timescale.py',import.meta.url));
    const child=spawn(process.env.HISTORY_PYTHON || 'python',[script,'--file',file,'--release',release,...extra],{env:process.env,windowsHide:true});
    let stdout='';
    child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>2_000_000)child.kill();});
    child.stderr.on('data',chunk=>console.warn('[Zenodo]',chunk.toString().trim()));
    child.on('error',reject);
    child.on('close',code=>{
      if(code!==0)return reject(new Error(`Archive importer exited ${code}`));
      try{resolve(JSON.parse(stdout.trim()));}catch{reject(new Error('Invalid archive import report'));}
    });
  });
}
export async function checkZenodoRelease() {
  return withHistoryLock(()=>updateRelease(),877002);
}
async function updateRelease() {
  const previous=await readReceipt('zenodo'); const checkedAt=new Date().toISOString();
  try {
    const status=await getApiStatus();
    const doi=status.zenodo?.record_doi; const id=doi?.match(/zenodo\.(\d+)$/)?.[1];
    if(!id || status.zenodo.status!=='ok')throw new Error('No verified Zenodo release');
    if(previous.release===doi && previous.ok) {
      const receipt={...previous,checkedAt};
      await writeReceipt('zenodo',receipt);
      await withHistoryLock(client=>publishHistoryStatus(client,'zenodo',receipt));
      return receipt;
    }
    const response=await fetch(`https://zenodo.org/api/records/${id}`,{signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error(`Zenodo metadata HTTP ${response.status}`);
    const record=await response.json();
    if(String(record.id)!==id)throw new Error('Release identity mismatch');
    const files=['10m','daily','events'].map(kind=>{
      const candidates=(record.files || []).filter(f=>new RegExp(`^ace-wind-\\d{4}-${kind}(-latest)?\\.parquet$`).test(f.key))
        .sort((a,b)=>Number(a.key.match(/\d{4}/)[0])-Number(b.key.match(/\d{4}/)[0]) || Number(a.key.includes('-latest'))-Number(b.key.includes('-latest')));
      const file=candidates.at(-1);
      if(!file || !/^md5:[a-f0-9]{32}$/i.test(file.checksum || ''))throw new Error(`Missing verified ${kind} archive`);
      return {...file,kind};
    });
    const signature=files.map(f=>f.checksum).join('|');
    if(previous.release===doi && previous.signature===signature && previous.ok) {
      await writeReceipt('zenodo',{...previous,checkedAt});return previous;
    }
    const directory=path.join(historyConfig.archive,'releases',id); await fs.mkdir(directory,{recursive:true});
    for(const f of files) {
      const url=new URL(f.links.self);
      if(url.protocol!=='https:' || !['zenodo.org','www.zenodo.org'].includes(url.hostname))throw new Error('Unexpected archive host');
      const download=await fetch(url,{signal:AbortSignal.timeout(180000)});
      if(!download.ok || !download.body)throw new Error('Archive download failed');
      f.local=path.join(directory,f.key); const temporary=`${f.local}.tmp`;
      await pipeline(Readable.fromWeb(download.body),createWriteStream(temporary));
      const hash=crypto.createHash('md5');
      for await(const chunk of createReadStream(temporary))hash.update(chunk);
      if(`md5:${hash.digest('hex')}`!==f.checksum.toLowerCase())throw new Error('Archive checksum mismatch');
      await fs.rename(temporary,f.local);
    }
    const report=await importArchive(files.find(f=>f.kind==='10m').local,doi,files.flatMap(f=>['--validate-file',f.local]));
    // All files have passed checksum and Parquet validation before publishing any public alias.
    for(const f of files) {
      const target=path.join(historyConfig.archive,`ace-wind-2026-${f.kind}-latest.parquet`);
      await fs.copyFile(f.local,`${target}.tmp`); await fs.rename(`${target}.tmp`,target);
    }
    const receipt={checkedAt,release:doi,signature,ok:true,lastSuccessAt:new Date().toISOString(),report};
    await withHistoryLock(client=>publishHistoryStatus(client,'zenodo',receipt));
    await writeReceipt('zenodo',receipt);return receipt;
  } catch(err) {
    await writeReceipt('zenodo',{...previous,checkedAt,ok:false,error:'Archive update failed; see server log'});
    console.warn('[Zenodo] Update failed:',err.message);return {ok:false};
  }
}
