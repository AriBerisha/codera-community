-- AlterTable
ALTER TABLE "Automation" ADD COLUMN "dataSources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
