-- AlterTable
ALTER TABLE "Team" ADD COLUMN "enabledIntegrations" TEXT[] DEFAULT ARRAY[]::TEXT[];
