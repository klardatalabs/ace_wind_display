// Hybrid retrieval over the knowledge base: semantic (vector) and keyword (full-text)
// searches run in parallel and are merged with reciprocal-rank fusion, so a passage that
// ranks well in either list surfaces, and one that ranks well in both wins.

import { embedQuery, embeddingsEnabled } from "../integrations/llm.js";
import { embeddingModel } from "./ingest.js";
import * as knowledge from "../db/repositories/knowledge.js";
import { logger } from "../lib/logger.js";
import { CURATED_SOURCES } from "./curated.js";

const log = logger("knowledge.search");
const RRF_K = 60; // the usual constant: damps the influence of top ranks
const CANDIDATES = 20;
// A public answer may use only text with verified reuse permission. The other
// titles stay as outbound references, including documents indexed previously.
export const SEARCHABLE_SOURCE_URLS = CURATED_SOURCES.filter((source) => source.indexable).map((source) => source.sourceUrl);

/** Reciprocal-rank fusion of several ranked lists of rows keyed by chunk_id. */
export function fuse(lists, limit) {
  const scores = new Map();
  for (const list of lists) {
    list.forEach((row, rank) => {
      const entry = scores.get(row.chunk_id) ?? { row, score: 0 };
      entry.score += 1 / (RRF_K + rank + 1);
      scores.set(row.chunk_id, entry);
    });
  }
  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, limit).map((e) => ({ ...e.row, score: e.score }));
}

/**
 * The best passages for `query`.
 * @returns {Promise<Array<{ title: string, author: string|null, pages: string, sourceUrl: string|null, sourceType: string|null, content: string, score: number }>>}
 */
export async function searchKnowledge(query, { limit = 6 } = {}) {
  const text = String(query).trim().slice(0, 500);
  if (!text || !SEARCHABLE_SOURCE_URLS.length) return [];
  const semantic = embeddingsEnabled
    ? (async () => {
        const [{ modelId, dimensions }, embedding] = await Promise.all([embeddingModel(), embedQuery(text)]);
        return knowledge.searchByVector({ modelId, dimensions, embedding, limit: CANDIDATES, sourceUrls: SEARCHABLE_SOURCE_URLS });
      })()
    : Promise.resolve([]);
  const keyword = knowledge.searchByKeywords({ text, limit: CANDIDATES, sourceUrls: SEARCHABLE_SOURCE_URLS });
  const [vectorHits, keywordHits] = await Promise.allSettled([semantic, keyword]);
  for (const r of [vectorHits, keywordHits]) if (r.status === "rejected") log.warn("one search half failed", { err: r.reason });
  const lists = [vectorHits, keywordHits].filter((r) => r.status === "fulfilled").map((r) => r.value);
  if (!lists.length) throw new Error("Knowledge search is unavailable");
  return fuse(lists, limit).map((row) => ({
    title: row.title,
    author: row.author,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
    pages: row.page_start === row.page_end ? `p. ${row.page_start}` : `pp. ${row.page_start}-${row.page_end}`,
    content: row.content,
    score: row.score,
  }));
}
