-- Add Telegram agent settings to AppSettings
ALTER TABLE "AppSettings" ADD COLUMN "telegramAutoReply" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppSettings" ADD COLUMN "telegramBotPrompt" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "telegramWebhookSecret" TEXT;

-- Make updateId nullable (bot-sent messages have no update_id)
ALTER TABLE "TelegramMessage" ALTER COLUMN "updateId" DROP NOT NULL;

-- Add isBot flag to distinguish bot-sent messages
ALTER TABLE "TelegramMessage" ADD COLUMN "isBot" BOOLEAN NOT NULL DEFAULT false;

-- Add Telegram output to Automations
ALTER TABLE "Automation" ADD COLUMN "telegramChatIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
