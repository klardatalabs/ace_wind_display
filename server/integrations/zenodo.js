// The ACE archive on Zenodo: find the release the ACE API points at, list its Parquet files
// and download them with checksum verification (the file only replaces the previous copy
// once its MD5 matches the one Zenodo publishes).

import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fetchApiStatus } from "./ace/history.js";

const KINDS = ["10m", "daily", "events"];
// Zenodo rejects requests without a descriptive User-Agent.
const HEADERS = { Accept: "application/json", "User-Agent": "WestonWind/3 (+community display)" };

/** The verified release the ACE API advertises: { doi, recordId }. */
export async function currentRelease() {
  const status = await fetchApiStatus();
  const doi = status.zenodo?.record_doi;
  const recordId = doi?.match(/zenodo\.(\d+)$/)?.[1];
  if (!recordId || status.zenodo?.status !== "ok") throw new Error("The ACE API reports no verified Zenodo release");
  return { doi, recordId };
}

/**
 * Every yearly file of each kind (10m, daily, events) in a Zenodo record, oldest year first.
 * When ACE publishes earlier years, they are picked up automatically.
 */
export async function releaseFiles(recordId) {
  const res = await fetch(`https://zenodo.org/api/records/${recordId}`, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Zenodo responded ${res.status}`);
  const record = await res.json();
  if (String(record.id) !== String(recordId)) throw new Error("Zenodo returned a different record");
  const files = [];
  for (const kind of KINDS) {
    const pattern = new RegExp(`^ace-wind-(\\d{4})-${kind}\\.parquet$`);
    for (const file of record.files ?? []) {
      const year = file.key.match(pattern)?.[1];
      if (!year) continue;
      if (!/^md5:[a-f0-9]{32}$/i.test(file.checksum ?? "")) throw new Error(`${file.key} has no published checksum`);
      const url = new URL(file.links.self);
      if (url.protocol !== "https:" || !["zenodo.org", "www.zenodo.org"].includes(url.hostname)) throw new Error("Unexpected archive host");
      files.push({ kind, year: Number(year), key: file.key, url: url.toString(), checksum: file.checksum.toLowerCase() });
    }
    if (!files.some((f) => f.kind === kind)) throw new Error(`Release has no ${kind} file`);
  }
  return files.sort((a, b) => a.year - b.year || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
}

/** Downloads `file` to `target`, verifying its MD5 before it replaces anything. */
export async function downloadVerified(file, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    const res = await fetch(file.url, { headers: { "User-Agent": HEADERS["User-Agent"] }, signal: AbortSignal.timeout(300_000) });
    if (!res.ok || !res.body) throw new Error(`Download of ${file.key} failed (${res.status})`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(temporary));
    const hash = crypto.createHash("md5");
    for await (const chunk of createReadStream(temporary)) hash.update(chunk);
    if (`md5:${hash.digest("hex")}` !== file.checksum) throw new Error(`Checksum mismatch for ${file.key}`);
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
