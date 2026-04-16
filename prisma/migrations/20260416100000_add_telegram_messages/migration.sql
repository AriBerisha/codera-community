-- CreateTable
CREATE TABLE "TelegramMessage" (
    "id" TEXT NOT NULL,
    "updateId" INTEGER NOT NULL,
    "chatId" BIGINT NOT NULL,
    "chatTitle" TEXT,
    "chatType" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromUsername" TEXT,
    "text" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramMessage_updateId_key" ON "TelegramMessage"("updateId");

-- CreateIndex
CREATE INDEX "TelegramMessage_chatId_idx" ON "TelegramMessage"("chatId");

-- CreateIndex
CREATE INDEX "TelegramMessage_sentAt_idx" ON "TelegramMessage"("sentAt");
