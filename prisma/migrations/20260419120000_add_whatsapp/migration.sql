-- AppSettings: WhatsApp fields
ALTER TABLE "AppSettings"
  ADD COLUMN "whatsappConnected"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "whatsappLinkedPhone" TEXT,
  ADD COLUMN "whatsappLinkedName"  TEXT,
  ADD COLUMN "whatsappAutoReply"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "whatsappBotPrompt"   TEXT,
  ADD COLUMN "whatsappAuthState"   TEXT;

-- Automation: WhatsApp chat IDs
ALTER TABLE "Automation"
  ADD COLUMN "whatsappChatIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- WhatsAppMessage table
CREATE TABLE "WhatsAppMessage" (
    "id"         TEXT NOT NULL,
    "messageId"  TEXT,
    "chatId"     TEXT NOT NULL,
    "chatTitle"  TEXT,
    "chatType"   TEXT NOT NULL,
    "fromName"   TEXT NOT NULL,
    "fromNumber" TEXT,
    "text"       TEXT NOT NULL,
    "isBot"      BOOLEAN NOT NULL DEFAULT false,
    "sentAt"     TIMESTAMP(3) NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppMessage_messageId_key" ON "WhatsAppMessage"("messageId");
CREATE INDEX "WhatsAppMessage_chatId_idx" ON "WhatsAppMessage"("chatId");
CREATE INDEX "WhatsAppMessage_sentAt_idx" ON "WhatsAppMessage"("sentAt");
