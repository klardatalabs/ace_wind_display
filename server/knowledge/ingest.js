// Ingests one document: extract -> clean -> split into passages -> embed -> store, with the
// document, every passage and every embedding written in one transaction (a half-ingested
// book never exists). A file whose contents are already stored is skipped.

import crypto from "node:crypto";
import path from "node:path";
import { config } from "../config/index.js";
import { embed } from "../integrations/llm.js";
import { extractDocument } from "./extract.js";
import { cleanPages } from "./clean.js";
import { chunkPages, passageContent, passageForEmbedding } from "./chunk.js";
import * as knowledge from "../db/repositories/knowledge.js";

let registered = null; // { modelId, dimensions } for the configured embedding model

/** Registers the configured embedding model, measuring its dimensions with a probe if needed. */
export async function embeddingModel() {
  if (registered) return registered;
  const dimensions = config.embeddings.dimensions || (await embed(["dimension probe"]))[0].length;
  registered = { modelId: await knowledge.registerModel(config.embeddings.model, dimensions), dimensions };
  return registered;
}

/**
 * @param {string} file
 * @param {{ title?: string, author?: string, sourceUrl?: string, sourceType?: string, rightsNote?: string, onProgress?: (done: number, total: number) => void }} [options]
 * @returns {Promise<{ status: "ingested"|"skipped", documentId: number, title: string, passages?: number }>}
 */
export async function ingestFile(file, { title, author, sourceUrl, sourceType, rightsNote, onProgress } = {}) {
  const doc = await extractDocument(file);
  const contentSha256 = crypto.createHash("sha256").update(doc.bytes).digest();
  const existing = await knowledge.findDocumentBySha256(contentSha256);
  if (existing) {
    await knowledge.updateDocumentSource(existing.id, { sourceUrl, sourceType, rightsNote });
    return { status: "skipped", documentId: existing.id, title: existing.title };
  }

  const finalTitle = (title || doc.title || path.basename(file, path.extname(file)).replace(/[_-]+/g, " ")).slice(0, 300);
  const passages = chunkPages(cleanPages(doc.pages));
  if (!passages.length) throw new Error(`No readable text found in ${path.basename(file)}`);

  const { modelId, dimensions } = await embeddingModel();
  const vectors = [];
  const BATCH = config.embeddings.batchSize;
  for (let i = 0; i < passages.length; i += BATCH) {
    vectors.push(...(await embed(passages.slice(i, i + BATCH).map((p) => passageForEmbedding(finalTitle, p)))));
    onProgress?.(Math.min(i + BATCH, passages.length), passages.length);
  }
  if (vectors.some((v) => v.length !== dimensions)) throw new Error("Embedding size changed during ingestion");

  const documentId = await knowledge.insertDocument({
    modelId,
    doc: {
      contentSha256,
      title: finalTitle,
      author: author || doc.author || null,
      fileName: path.basename(file),
      mediaType: doc.mediaType,
      byteSize: doc.bytes.length,
      pageCount: doc.pages.length,
      sourceUrl: sourceUrl || null,
      sourceType: sourceType || null,
      rightsNote: rightsNote || null,
    },
    passages: passages.map((p, i) => ({
      position: p.position, pageStart: p.pageStart, pageEnd: p.pageEnd, content: passageContent(p), embedding: vectors[i],
    })),
  });
  return { status: "ingested", documentId, title: finalTitle, passages: passages.length };
}
