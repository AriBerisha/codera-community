import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { TelegramClient } from "@/lib/telegram/client";
import { generateText } from "ai";
import { getModelInstance } from "@/lib/ai/providers";

/**
 * Sync new messages from Telegram and process auto-replies.
 * Called by the cron endpoint and the Agents page refresh.
 */
export async function syncTelegramAndReply(): Promise<{
  synced: number;
  replied: number;
}> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.telegramBotToken) return { synced: 0, replied: 0 };

  const client = new TelegramClient(decrypt(settings.telegramBotToken));
  let synced = 0;

  // Only poll if no webhook is set
  const webhookInfo = await client.getWebhookInfo();
  if (!webhookInfo.url) {
    const lastStored = await prisma.telegramMessage.findFirst({
      where: { updateId: { not: null } },
      orderBy: { updateId: "desc" },
      select: { updateId: true },
    });
    const offset = lastStored?.updateId ? lastStored.updateId + 1 : undefined;

    const updates = await client.getUpdates(100, offset);

    for (const update of updates) {
      const msg = update.message;
      if (!msg?.text) continue;

      await prisma.telegramMessage.upsert({
        where: { updateId: update.update_id },
        update: {},
        create: {
          updateId: update.update_id,
          chatId: msg.chat.id,
          chatTitle: msg.chat.title || msg.from?.first_name || null,
          chatType: msg.chat.type,
          fromName: msg.from?.first_name || "Unknown",
          fromUsername: msg.from?.username || null,
          text: msg.text,
          sentAt: new Date(msg.date * 1000),
        },
      });
      synced++;
    }

    if (updates.length > 0) {
      const maxId = Math.max(...updates.map((u) => u.update_id));
      await client.getUpdates(1, maxId + 1);
    }
  }

  // Auto-reply
  let replied = 0;
  if (settings.telegramAutoReply) {
    const bot = await client.validateConnection();
    const botUsername = bot.username?.toLowerCase();
    if (botUsername) {
      replied = await processAutoReplies(
        client,
        botUsername,
        settings.telegramBotPrompt
      );
    }
  }

  return { synced, replied };
}

async function processAutoReplies(
  client: TelegramClient,
  botUsername: string,
  botPrompt: string | null
): Promise<number> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const candidates = await prisma.telegramMessage.findMany({
    where: {
      isBot: false,
      sentAt: { gte: fiveMinAgo },
      OR: [
        { chatType: "private" },
        { text: { contains: `@${botUsername}`, mode: "insensitive" } },
      ],
    },
    orderBy: { sentAt: "asc" },
  });

  let replied = 0;

  for (const msg of candidates) {
    const alreadyReplied = await prisma.telegramMessage.findFirst({
      where: {
        chatId: msg.chatId,
        isBot: true,
        sentAt: { gte: msg.sentAt },
      },
    });

    if (alreadyReplied) continue;

    try {
      const systemPrompt =
        botPrompt ||
        "You are a helpful assistant in a Telegram chat. Keep responses concise and friendly. Do not use Markdown formatting.";

      const model = await getModelInstance();
      const { text: reply } = await generateText({
        model,
        system: systemPrompt,
        prompt: `User "${msg.fromName}" says: ${msg.text}`,
        maxOutputTokens: 1024,
      });

      await client.sendMessage(msg.chatId.toString(), reply);

      await prisma.telegramMessage.create({
        data: {
          chatId: msg.chatId,
          chatTitle: msg.chatTitle,
          chatType: msg.chatType,
          fromName: "Bot",
          fromUsername: null,
          text: reply,
          isBot: true,
          sentAt: new Date(),
        },
      });

      replied++;
      console.log(
        `[Telegram] Auto-replied in chat ${msg.chatId}: "${reply.substring(0, 60)}..."`
      );
    } catch (err) {
      console.error("[Telegram] Auto-reply error:", err);
    }
  }

  return replied;
}
