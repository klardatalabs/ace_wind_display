// Knowledge base admin from the command line:
//   npm run knowledge -- ingest [path] [--title "..."] [--author "..."]   (default path: ingestion/)
//   npm run knowledge -- list
//   npm run knowledge -- remove <documentId>
//   npm run knowledge -- search "<question>"

import fs from "node:fs/promises";
import path from "node:path";
import { validateConfig } from "../config/index.js";
import { closePostgres } from "../infra/postgres.js";
import { connectRedis, closeRedis } from "../infra/redis.js";
import { ingestFile } from "../knowledge/ingest.js";
import { searchKnowledge } from "../knowledge/search.js";
import { supportedExtensions } from "../knowledge/extract.js";
import * as knowledge from "../db/repositories/knowledge.js";

const [command, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest.splice(i, 2)[1] : undefined;
};

async function filesIn(target) {
  const stat = await fs.stat(target);
  if (stat.isFile()) return [target];
  const names = (await fs.readdir(target)).filter((n) => supportedExtensions.includes(path.extname(n).toLowerCase()));
  return names.sort().map((n) => path.join(target, n));
}

async function main() {
  validateConfig();
  await connectRedis();
  if (command === "ingest") {
    const title = flag("title");
    const author = flag("author");
    const files = await filesIn(rest[0] ?? "ingestion");
    if (!files.length) return console.log("No supported files found.");
    for (const file of files) {
      const started = Date.now();
      const result = await ingestFile(file, {
        title: files.length === 1 ? title : undefined,
        author: files.length === 1 ? author : undefined,
        onProgress: (done, total) => process.stdout.write(`\r  ${path.basename(file)}: embedded ${done}/${total}`),
      });
      process.stdout.write("\n");
      console.log(result.status === "skipped"
        ? `  skipped (already stored as #${result.documentId} "${result.title}")`
        : `  stored #${result.documentId} "${result.title}": ${result.passages} passages in ${((Date.now() - started) / 1000).toFixed(0)} s`);
    }
  } else if (command === "list") {
    for (const d of await knowledge.listDocuments()) console.log(`#${d.id}  ${d.title}${d.author ? ` (${d.author})` : ""}  ${d.pageCount ?? "?"} pages, ${d.passages} passages`);
  } else if (command === "remove") {
    console.log((await knowledge.deleteDocument(Number(rest[0]))) ? "removed" : "no such document");
  } else if (command === "search") {
    for (const hit of await searchKnowledge(rest.join(" "))) {
      console.log(`\n[${hit.score.toFixed(4)}] ${hit.title}, ${hit.pages}\n${hit.content.slice(0, 400)}`);
    }
  } else {
    console.log("Usage: knowledge ingest [path] | list | remove <id> | search <question>");
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (err) {
  console.error(`Failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeRedis();
  await closePostgres();
}
