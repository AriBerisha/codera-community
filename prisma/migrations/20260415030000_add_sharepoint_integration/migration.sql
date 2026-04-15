-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "sharepointClientId" TEXT,
ADD COLUMN     "sharepointClientSecret" TEXT,
ADD COLUMN     "sharepointTenantId" TEXT;

-- CreateTable
CREATE TABLE "SharePointSite" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "webUrl" TEXT NOT NULL,
    "lastIndexedAt" TIMESTAMP(3),
    "indexStatus" "IndexStatus" NOT NULL DEFAULT 'PENDING',
    "included" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharePointSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharePointFile" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "driveItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT,
    "webUrl" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "sha" TEXT,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharePointFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharePointSite_siteId_key" ON "SharePointSite"("siteId");

-- CreateIndex
CREATE INDEX "SharePointSite_siteId_idx" ON "SharePointSite"("siteId");

-- CreateIndex
CREATE INDEX "SharePointSite_indexStatus_idx" ON "SharePointSite"("indexStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SharePointFile_driveItemId_key" ON "SharePointFile"("driveItemId");

-- CreateIndex
CREATE INDEX "SharePointFile_siteId_idx" ON "SharePointFile"("siteId");

-- CreateIndex
CREATE INDEX "SharePointFile_name_idx" ON "SharePointFile"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SharePointFile_siteId_driveItemId_key" ON "SharePointFile"("siteId", "driveItemId");

-- AddForeignKey
ALTER TABLE "SharePointFile" ADD CONSTRAINT "SharePointFile_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "SharePointSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
