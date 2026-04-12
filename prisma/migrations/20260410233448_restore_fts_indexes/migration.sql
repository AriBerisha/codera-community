-- Restore pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Restore generated tsvector column on IndexedFile
ALTER TABLE "IndexedFile"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("fileName", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("filePath", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("content", '')), 'B')
  ) STORED;

-- Restore GIN index on tsvector column
CREATE INDEX idx_indexed_file_search ON "IndexedFile" USING GIN ("search_vector");

-- Restore GIN trigram index on filePath
CREATE INDEX idx_indexed_file_path_trgm ON "IndexedFile" USING GIN ("filePath" gin_trgm_ops);

-- Restore GIN trigram index on content
CREATE INDEX idx_indexed_file_content_trgm ON "IndexedFile" USING GIN ("content" gin_trgm_ops);
