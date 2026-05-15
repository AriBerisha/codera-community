-- CreateTable
CREATE TABLE "TeamMemory" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamMemory_teamId_idx" ON "TeamMemory"("teamId");

-- CreateIndex
CREATE INDEX "TeamMemory_createdAt_idx" ON "TeamMemory"("createdAt");

-- AddForeignKey
ALTER TABLE "TeamMemory" ADD CONSTRAINT "TeamMemory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemory" ADD CONSTRAINT "TeamMemory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
