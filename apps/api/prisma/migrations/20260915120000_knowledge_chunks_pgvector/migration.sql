-- Migrate KnowledgeChunk embeddings from JSONB to native pgvector.
--
-- Why: similarity search previously loaded every chunk + full embedding of an
-- atom over the wire and computed cosine similarity in a JS loop. With
-- pgvector the comparison happens in Postgres via the `<=>` (cosine distance)
-- operator, with an HNSW ANN index where supported.
--
-- Dimension policy: embeddings in this system come from providers with
-- DIFFERENT dimensions (nomic-embed-text / text-embedding-004 = 768,
-- text-embedding-3-small = 1536). The column is therefore `vector` WITHOUT a
-- fixed typmod, so rows of any dimension can coexist. The dimension filter is
-- enforced per query (see PrismaKnowledgeChunkRepository.searchRelevantChunks).
CREATE EXTENSION IF NOT EXISTS vector;

-- JSONB array of numbers → vector literal ('[a,b,c]').
-- NULL, non-array JSONB and zero-length arrays become NULL (no embedding).
-- Malformed rows (non-numeric values) surface as cast errors: corrupt data
-- should fail loudly, not silently degrade search quality.
ALTER TABLE "knowledge_chunks"
  ALTER COLUMN "embedding" TYPE vector
  USING (
    CASE
      WHEN "embedding" IS NULL
        OR jsonb_typeof("embedding") <> 'array'
        OR jsonb_array_length("embedding") = 0
      THEN NULL::vector
      ELSE (
        SELECT ('[' || string_agg(t.value, ',' ORDER BY t.ord) || ']')::vector
        FROM jsonb_array_elements_text("embedding") WITH ORDINALITY AS t(value, ord)
      )
    END
  );

-- ANN index for cosine distance. Indexing a typmod-less vector column (mixed
-- dimensions) is only supported by recent pgvector versions; if this engine
-- refuses it, the migration still succeeds and search degrades to a server-side
-- sequential scan (already strictly better than the previous JS round-trip).
-- Pinning a single embedding provider/dimension re-enables it everywhere.
DO $$
BEGIN
  CREATE INDEX "knowledge_chunks_embedding_hnsw_idx"
    ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'HNSW index on "knowledge_chunks"."embedding" skipped (SQLSTATE %): %', SQLSTATE, SQLERRM;
END $$;
