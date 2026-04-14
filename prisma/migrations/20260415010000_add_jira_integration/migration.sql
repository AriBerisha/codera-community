-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "jiraApiToken" TEXT,
ADD COLUMN     "jiraEmail" TEXT,
ADD COLUMN     "jiraUrl" TEXT;

-- CreateTable
CREATE TABLE "JiraProject" (
    "id" TEXT NOT NULL,
    "jiraId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "webUrl" TEXT NOT NULL,
    "lastIndexedAt" TIMESTAMP(3),
    "indexStatus" "IndexStatus" NOT NULL DEFAULT 'PENDING',
    "included" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JiraProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JiraIssue" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jiraId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "issueType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT,
    "assignee" TEXT,
    "reporter" TEXT,
    "labels" TEXT[],
    "webUrl" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JiraIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JiraProject_jiraId_key" ON "JiraProject"("jiraId");

-- CreateIndex
CREATE INDEX "JiraProject_jiraId_idx" ON "JiraProject"("jiraId");

-- CreateIndex
CREATE INDEX "JiraProject_indexStatus_idx" ON "JiraProject"("indexStatus");

-- CreateIndex
CREATE UNIQUE INDEX "JiraIssue_jiraId_key" ON "JiraIssue"("jiraId");

-- CreateIndex
CREATE INDEX "JiraIssue_projectId_idx" ON "JiraIssue"("projectId");

-- CreateIndex
CREATE INDEX "JiraIssue_key_idx" ON "JiraIssue"("key");

-- CreateIndex
CREATE INDEX "JiraIssue_issueType_idx" ON "JiraIssue"("issueType");

-- CreateIndex
CREATE INDEX "JiraIssue_status_idx" ON "JiraIssue"("status");

-- CreateIndex
CREATE UNIQUE INDEX "JiraIssue_projectId_key_key" ON "JiraIssue"("projectId", "key");

-- AddForeignKey
ALTER TABLE "JiraIssue" ADD CONSTRAINT "JiraIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JiraProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
