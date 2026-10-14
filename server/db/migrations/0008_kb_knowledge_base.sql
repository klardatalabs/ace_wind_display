-- Knowledge base: books and documents, split into passages ("chunks") and embedded for
-- semantic search. Embeddings are stored per model, so switching embedding provider only
-- needs a re-embed, never a schema change. Each model gets its own vector index, created
-- by the ingester when the model is first registered (index dimensions must be fixed).

CREATE TABLE kb.document (
  document_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_sha256  bytea NOT NULL UNIQUE CHECK (length(content_sha256) = 32),
  title           text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  author          text CHECK (length(author) <= 300),
  file_name       text NOT NULL,
  media_type      text NOT NULL,
  byte_size       bigint NOT NULL CHECK (byte_size > 0),
  page_count      integer CHECK (page_count > 0),
  added_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE kb.chunk (
  chunk_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id  bigint NOT NULL REFERENCES kb.document ON DELETE CASCADE,
  position     integer NOT NULL CHECK (position >= 1),
  page_start   integer CHECK (page_start >= 1),
  page_end     integer CHECK (page_end >= page_start),
  content      text NOT NULL CHECK (length(content) BETWEEN 1 AND 20000),
  UNIQUE (document_id, position)
);
-- Keyword search alongside the vector search (hybrid retrieval).
CREATE INDEX chunk_content_fts_idx ON kb.chunk USING gin (to_tsvector('english', content));

CREATE TABLE kb.embedding_model (
  model_id    smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  dimensions  integer NOT NULL CHECK (dimensions BETWEEN 1 AND 4000),
  UNIQUE (name, dimensions)
);

CREATE TABLE kb.chunk_embedding (
  chunk_id   bigint NOT NULL REFERENCES kb.chunk ON DELETE CASCADE,
  model_id   smallint NOT NULL REFERENCES kb.embedding_model,
  embedding  vector NOT NULL,
  PRIMARY KEY (chunk_id, model_id)
);
