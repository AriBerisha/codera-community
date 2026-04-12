-- Enable pg_trgm extension for trigram similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add a generated tsvector column to IndexedFile
ALTER TABLE "IndexedFile"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("fileName", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("filePath", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("content", '')), 'B')
  ) STORED;

-- GIN index on the tsvector column for fast full-text search
CREATE INDEX idx_indexed_file_search ON "IndexedFile" USING GIN ("search_vector");

-- GIN trigram index on filePath for fuzzy path matching
CREATE INDEX idx_indexed_file_path_trgm ON "IndexedFile" USING GIN ("filePath" gin_trgm_ops);

-- GIN trigram index on content for substring matching
CREATE INDEX idx_indexed_file_content_trgm ON "IndexedFile" USING GIN ("content" gin_trgm_ops);
