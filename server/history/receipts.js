import fs from 'node:fs/promises';
import path from 'node:path';
import {historyConfig} from './config.js';
export async function readReceipt(name) {
  try {return JSON.parse(await fs.readFile(path.join(historyConfig.operations,`${name}.json`),'utf8'));}
  catch(err) {if(err.code==='ENOENT')return {};throw err;}
}
export async function writeReceipt(name,value) {
  await fs.mkdir(historyConfig.operations,{recursive:true});
  const target=path.join(historyConfig.operations,`${name}.json`);
  const temp=`${target}.${process.pid}.tmp`;
  await fs.writeFile(temp,JSON.stringify(value,null,2));
  await fs.rename(temp,target);
}
