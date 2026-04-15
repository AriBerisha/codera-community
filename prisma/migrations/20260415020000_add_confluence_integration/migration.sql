-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "confluenceApiToken" TEXT,
ADD COLUMN     "confluenceEmail" TEXT,
ADD COLUMN     "confluenceUrl" TEXT;

-- CreateTable
CREATE TABLE "ConfluenceSpace" (
    "id" TEXT NOT NULL,
    "confluenceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "webUrl" TEXT NOT NULL,
    "lastIndexedAt" TIMESTAMP(3),
    "indexStatus" "IndexStatus" NOT NULL DEFAULT 'PENDING',
    "included" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfluenceSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfluencePage" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "confluenceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "webUrl" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfluencePage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfluenceSpace_confluenceId_key" ON "ConfluenceSpace"("confluenceId");

-- CreateIndex
CREATE INDEX "ConfluenceSpace_confluenceId_idx" ON "ConfluenceSpace"("confluenceId");

-- CreateIndex
CREATE INDEX "ConfluenceSpace_indexStatus_idx" ON "ConfluenceSpace"("indexStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ConfluencePage_confluenceId_key" ON "ConfluencePage"("confluenceId");

-- CreateIndex
CREATE INDEX "ConfluencePage_spaceId_idx" ON "ConfluencePage"("spaceId");

-- CreateIndex
CREATE INDEX "ConfluencePage_title_idx" ON "ConfluencePage"("title");

-- CreateIndex
CREATE UNIQUE INDEX "ConfluencePage_spaceId_confluenceId_key" ON "ConfluencePage"("spaceId", "confluenceId");

-- AddForeignKey
ALTER TABLE "ConfluencePage" ADD CONSTRAINT "ConfluencePage_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "ConfluenceSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
