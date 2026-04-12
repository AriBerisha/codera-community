-- CreateEnum
CREATE TYPE "WorkflowStepType" AS ENUM ('PLANNING', 'PROGRAMMING', 'COMMIT');

-- CreateEnum
CREATE TYPE "WorkflowExecutionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FileChangeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMMITTED');

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkflowStepType" NOT NULL,
    "order" INTEGER NOT NULL,
    "config" JSONB,
    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecution" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStepOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "WorkflowExecutionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "planText" TEXT,
    "commitBranch" TEXT,
    "commitMessage" TEXT,
    "commitResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileChange" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalContent" TEXT NOT NULL,
    "modifiedContent" TEXT NOT NULL,
    "language" TEXT,
    "status" "FileChangeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FileChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workflow_isActive_idx" ON "Workflow"("isActive");
CREATE INDEX "WorkflowStep_workflowId_idx" ON "WorkflowStep"("workflowId");
CREATE UNIQUE INDEX "WorkflowStep_workflowId_order_key" ON "WorkflowStep"("workflowId", "order");
CREATE INDEX "WorkflowExecution_conversationId_idx" ON "WorkflowExecution"("conversationId");
CREATE INDEX "WorkflowExecution_userId_idx" ON "WorkflowExecution"("userId");
CREATE INDEX "WorkflowExecution_status_idx" ON "WorkflowExecution"("status");
CREATE INDEX "FileChange_executionId_idx" ON "FileChange"("executionId");
CREATE UNIQUE INDEX "FileChange_executionId_projectId_filePath_key" ON "FileChange"("executionId", "projectId", "filePath");

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FileChange" ADD CONSTRAINT "FileChange_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "WorkflowExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default workflow
INSERT INTO "Workflow" ("id", "name", "description", "isDefault", "isActive", "createdAt", "updatedAt")
VALUES ('default-workflow', 'Code Change', 'Plan, implement, and commit code changes', true, true, NOW(), NOW());

INSERT INTO "WorkflowStep" ("id", "workflowId", "name", "type", "order")
VALUES
  ('step-planning', 'default-workflow', 'Planning', 'PLANNING', 0),
  ('step-programming', 'default-workflow', 'Programming', 'PROGRAMMING', 1),
  ('step-commit', 'default-workflow', 'Commit', 'COMMIT', 2);
