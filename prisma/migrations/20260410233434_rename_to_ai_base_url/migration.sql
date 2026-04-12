/*
  Warnings:

  - You are about to drop the column `ollamaBaseUrl` on the `AppSettings` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `IndexedFile` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "idx_indexed_file_content_trgm";

-- DropIndex
DROP INDEX "idx_indexed_file_path_trgm";

-- DropIndex
DROP INDEX "idx_indexed_file_search";

-- AlterTable
ALTER TABLE "AppSettings" DROP COLUMN "ollamaBaseUrl",
ADD COLUMN     "aiBaseUrl" TEXT;

-- AlterTable
ALTER TABLE "IndexedFile" DROP COLUMN "search_vector";
