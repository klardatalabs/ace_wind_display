// Knowledge base storage: documents, their passages and embeddings, and the two halves of
// hybrid search (vector similarity and full-text). The search service fuses the two.

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../client.js";
import { pool } from "../../infra/postgres.js";
import { document, chunk, embeddingModel, chunkEmbedding } from "../schema/kb.js";

const assertInt = (n, what) => {
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid ${what}`);
  return n;
};
const vectorLiteral = (v) => `[${v.map(Number).join(",")}]`;

/**
 * Registers an embedding model (idempotent) and makes sure it has a vector index.
 * The HNSW index is partial (one model) over half-precision vectors, which also allows
 * models with up to 4000 dimensions.
 */
export async function registerModel(name, dimensions) {
  const [row] = await db
    .insert(embeddingModel)
    .values({ name, dimensions })
    .onConflictDoUpdate({ target: [embeddingModel.name, embeddingModel.dimensions], set: { name } })
    .returning({ id: embeddingModel.modelId });
  const id = assertInt(row.id, "model id");
  const dims = assertInt(dimensions, "dimensions");
  await pool.query(
    `CREATE INDEX IF NOT EXISTS chunk_embedding_m${id}_hnsw ON kb.chunk_embedding
     USING hnsw ((embedding::halfvec(${dims})) halfvec_cosine_ops) WHERE model_id = ${id}`
  );
  return id;
}

export async function findDocumentBySha256(sha256) {
  const [row] = await db.select({ id: document.documentId, title: document.title }).from(document).where(eq(document.contentSha256, sha256));
  return row ?? null;
}

export async function updateDocumentSource(id, { sourceUrl, sourceType, rightsNote }) {
  if (!sourceUrl) return;
  await db.update(document).set({ sourceUrl, sourceType, rightsNote }).where(eq(document.documentId, id));
}

/** Stores a document with all its passages and their embeddings, atomically. */
export async function insertDocument({ doc, passages, modelId }) {
  return db.transaction(async (tx) => {
    const [{ id }] = await tx.insert(document).values(doc).returning({ id: document.documentId });
    const BATCH = 200;
    for (let i = 0; i < passages.length; i += BATCH) {
      const slice = passages.slice(i, i + BATCH);
      const inserted = await tx
        .insert(chunk)
        .values(slice.map((p) => ({ documentId: id, position: p.position, pageStart: p.pageStart, pageEnd: p.pageEnd, content: p.content })))
        .returning({ chunkId: chunk.chunkId, position: chunk.position });
      const byPosition = new Map(inserted.map((r) => [r.position, r.chunkId]));
      await tx.insert(chunkEmbedding).values(slice.map((p) => ({ chunkId: byPosition.get(p.position), modelId, embedding: p.embedding })));
    }
    return id;
  });
}

export async function listDocuments() {
  return db
    .select({
      id: document.documentId, title: document.title, author: document.author, fileName: document.fileName, sourceUrl: document.sourceUrl, sourceType: document.sourceType,
      pageCount: document.pageCount, addedAt: document.addedAt, passages: sql`count(${chunk.chunkId})`.mapWith(Number),
    })
    .from(document)
    .leftJoin(chunk, eq(chunk.documentId, document.documentId))
    .groupBy(document.documentId)
    .orderBy(asc(document.title));
}

export async function deleteDocument(documentId) {
  const result = await db.delete(document).where(eq(document.documentId, documentId));
  return result.rowCount;
}

const PASSAGE_COLUMNS = `c.chunk_id, c.position, c.page_start, c.page_end, c.content, d.document_id, d.title, d.author, d.source_url, d.source_type`;

/** Nearest passages by cosine distance for one embedding model. */
export async function searchByVector({ modelId, dimensions, embedding, limit }) {
  const id = assertInt(modelId, "model id");
  const dims = assertInt(dimensions, "dimensions");
  // model_id is inlined so the planner can match the partial HNSW index.
  const { rows } = await pool.query(
    `SELECT ${PASSAGE_COLUMNS}, (e.embedding::halfvec(${dims})) <=> $1::halfvec(${dims}) AS distance
     FROM kb.chunk_embedding e
     JOIN kb.chunk c ON c.chunk_id = e.chunk_id
     JOIN kb.document d ON d.document_id = c.document_id
     WHERE e.model_id = ${id}
     ORDER BY (e.embedding::halfvec(${dims})) <=> $1::halfvec(${dims})
     LIMIT $2`,
    [vectorLiteral(embedding), limit]
  );
  return rows;
}

/** Best keyword matches (English full-text search over passages). */
export async function searchByKeywords({ text, limit }) {
  const { rows } = await pool.query(
    `SELECT ${PASSAGE_COLUMNS}, ts_rank_cd(to_tsvector('english', c.content), q) AS rank
     FROM kb.chunk c
     JOIN kb.document d ON d.document_id = c.document_id,
          websearch_to_tsquery('english', $1) q
     WHERE to_tsvector('english', c.content) @@ q
     ORDER BY rank DESC
     LIMIT $2`,
    [text, limit]
  );
  return rows;
}

/** Neighbouring passages, so an answer can read a little before and after a hit. */
export async function passagesAround(documentId, position, radius = 1) {
  return db
    .select({ position: chunk.position, content: chunk.content })
    .from(chunk)
    .where(and(eq(chunk.documentId, documentId), sql`${chunk.position} BETWEEN ${position - radius} AND ${position + radius}`))
    .orderBy(asc(chunk.position));
}
