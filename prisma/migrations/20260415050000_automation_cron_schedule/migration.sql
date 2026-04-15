-- Replace intervalMinutes with cron-based scheduling
ALTER TABLE "Automation" ADD COLUMN "cronExpression" TEXT NOT NULL DEFAULT '0 * * * *';
ALTER TABLE "Automation" ADD COLUMN "scheduleType" TEXT NOT NULL DEFAULT 'interval';
ALTER TABLE "Automation" ADD COLUMN "scheduleConfig" JSONB;

-- Migrate existing data: convert intervalMinutes to scheduleConfig
UPDATE "Automation" SET
  "scheduleConfig" = jsonb_build_object('intervalMinutes', "intervalMinutes"),
  "scheduleType" = 'interval';

-- Drop the old column
ALTER TABLE "Automation" DROP COLUMN "intervalMinutes";
