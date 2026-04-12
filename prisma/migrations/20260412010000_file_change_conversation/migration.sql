-- AlterTable: make executionId optional, add conversationId
ALTER TABLE "FileChange" ALTER COLUMN "executionId" DROP NOT NULL;

ALTER TABLE "FileChange" ADD COLUMN "conversationId" TEXT;

-- Add foreign key
ALTER TABLE "FileChange" ADD CONSTRAINT "FileChange_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add unique constraint and index
CREATE UNIQUE INDEX "FileChange_conversationId_projectId_filePath_key" ON "FileChange"("conversationId", "projectId", "filePath");
CREATE INDEX "FileChange_conversationId_idx" ON "FileChange"("conversationId");
