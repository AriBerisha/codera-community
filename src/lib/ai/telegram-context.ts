import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { TelegramClient } from "@/lib/telegram/client";

const MAX_MESSAGES = 20;
const MAX_TEXT_LENGTH = 500;

/**
 * Sync new messages from Telegram API into the database,
 * then build AI context from recent stored messages.
 */
export async function buildTelegramContext(userMessage: string): Promise<string> {
  void userMessage; // available for future keyword filtering

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.telegramBotToken) return "";

  // Sync new messages from Telegram
  try {
    const client = new TelegramClient(decrypt(settings.telegramBotToken));

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
    }

    if (updates.length > 0) {
      const maxId = Math.max(...updates.map((u) => u.update_id));
      await client.getUpdates(1, maxId + 1);
    }
  } catch (err) {
    console.error("[TelegramContext] Sync error:", err);
  }

  // Read recent messages from DB
  const messages = await prisma.telegramMessage.findMany({
    orderBy: { sentAt: "desc" },
    take: MAX_MESSAGES,
  });

  if (messages.length === 0) return "";

  let context = "\n\nHere are recent Telegram messages received by the bot:\n\n";

  // Reverse to show oldest first
  for (const msg of messages.reverse()) {
    const chatName = msg.chatTitle || `Chat ${msg.chatId}`;
    const text =
      msg.text.length > MAX_TEXT_LENGTH
        ? msg.text.substring(0, MAX_TEXT_LENGTH) + "..."
        : msg.text;

    context += `--- Telegram: ${chatName} (${msg.chatType}) ---\n`;
    context += `From: ${msg.fromName}${msg.fromUsername ? ` (@${msg.fromUsername})` : ""}\n`;
    context += `Date: ${msg.sentAt.toISOString()}\n`;
    context += `${text}\n\n`;
  }

  return context;
}
