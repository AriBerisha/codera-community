-- Add GitHub fields to AppSettings
ALTER TABLE "AppSettings" ADD COLUMN "githubUrl" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "githubPat" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "githubOrgName" TEXT;

-- Create GithubProject table
CREATE TABLE "GithubProject" (
    "id" TEXT NOT NULL,
    "githubId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "description" TEXT,
    "htmlUrl" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "lastIndexedAt" TIMESTAMP(3),
    "indexStatus" "IndexStatus" NOT NULL DEFAULT 'PENDING',
    "included" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubProject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GithubProject_githubId_key" ON "GithubProject"("githubId");
CREATE INDEX "GithubProject_githubId_idx" ON "GithubProject"("githubId");
CREATE INDEX "GithubProject_indexStatus_idx" ON "GithubProject"("indexStatus");

-- Make IndexedFile.projectId optional and add githubProjectId
ALTER TABLE "IndexedFile" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "IndexedFile" ADD COLUMN "githubProjectId" TEXT;

CREATE UNIQUE INDEX "IndexedFile_githubProjectId_filePath_key" ON "IndexedFile"("githubProjectId", "filePath");
CREATE INDEX "IndexedFile_githubProjectId_idx" ON "IndexedFile"("githubProjectId");

ALTER TABLE "IndexedFile" ADD CONSTRAINT "IndexedFile_githubProjectId_fkey" FOREIGN KEY ("githubProjectId") REFERENCES "GithubProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
