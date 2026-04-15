-- AlterTable: Add Resend settings
ALTER TABLE "AppSettings" ADD COLUMN "resendApiKey" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "resendFromEmail" TEXT;

-- AlterTable: Add email recipients to Automation
ALTER TABLE "Automation" ADD COLUMN "emailRecipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
