-- Per-conversation integration scope. Empty array means "all team-allowed".
ALTER TABLE "Conversation" ADD COLUMN "integrationIds" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL;
