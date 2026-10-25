// kb schema: the knowledge base (books and documents, their passages, and embeddings).

import { pgSchema, text, integer, smallint, bigint, primaryKey, customType } from "drizzle-orm/pg-core";
import { bytea, timestamptz } from "./columns.js";

export const kb = pgSchema("kb");

// pgvector column without fixed dimensions (each embedding model has its own index).
const anyVector = customType({
  dataType: () => "vector",
  toDriver: (value) => `[${value.join(",")}]`,
  fromDriver: (value) => JSON.parse(value),
});

export const document = kb.table("document", {
  documentId: bigint("document_id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  contentSha256: bytea("content_sha256").notNull(),
  title: text("title").notNull(),
  author: text("author"),
  fileName: text("file_name").notNull(),
  mediaType: text("media_type").notNull(),
  byteSize: bigint("byte_size", { mode: "number" }).notNull(),
  pageCount: integer("page_count"),
  sourceUrl: text("source_url"),
  sourceType: text("source_type"),
  rightsNote: text("rights_note"),
  addedAt: timestamptz("added_at").notNull().defaultNow(),
});

export const chunk = kb.table("chunk", {
  chunkId: bigint("chunk_id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  documentId: bigint("document_id", { mode: "number" }).notNull().references(() => document.documentId, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  pageStart: integer("page_start"),
  pageEnd: integer("page_end"),
  content: text("content").notNull(),
});

export const embeddingModel = kb.table("embedding_model", {
  modelId: smallint("model_id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  dimensions: integer("dimensions").notNull(),
});

export const chunkEmbedding = kb.table(
  "chunk_embedding",
  {
    chunkId: bigint("chunk_id", { mode: "number" }).notNull().references(() => chunk.chunkId, { onDelete: "cascade" }),
    modelId: smallint("model_id").notNull().references(() => embeddingModel.modelId),
    embedding: anyVector("embedding").notNull(),
  },
  (t) => [primaryKey({ columns: [t.chunkId, t.modelId] })]
);
