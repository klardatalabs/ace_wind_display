// Packs the trimmed scan into Spark's compressed .spz format (about 40% smaller to download).
//
//   python scripts/trim-scan.py && node scripts/splat-to-spz.mjs
//
// Defaults: frontend/public/scenes/lawrence-weston-site.splat -> .spz (and removes the .splat)

import { readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = process.argv[2] ?? path.join(root, "frontend/public/scenes/lawrence-weston-site.splat");
const output = process.argv[3] ?? input.replace(/\.splat$/, ".spz");

globalThis.self ??= globalThis; // Spark expects a browser-like global
const { transcodeSpz } = await import(pathToFileURL(path.join(root, "frontend/node_modules/@sparkjsdev/spark/dist/spark.module.js")).href);
const bytes = new Uint8Array(readFileSync(input));
const { fileBytes } = await transcodeSpz({ inputs: [{ fileBytes: bytes, fileType: "splat", pathOrUrl: input }], maxSh: 0 });
writeFileSync(output, fileBytes);
if (!process.argv[2]) rmSync(input);
console.log(`${(bytes.length / 1e6).toFixed(1)} MB -> ${(fileBytes.length / 1e6).toFixed(1)} MB: ${path.relative(root, output)}`);
process.exit(0);
