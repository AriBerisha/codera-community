import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { TelegramClient } from "@/lib/telegram/client";
import { generateText } from "ai";
import { getModelInstance } from "@/lib/ai/providers";

/** POST — Telegram webhook: receives updates pushed by Telegram servers. */
export async function POST(req: Request) {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.telegramBotToken || !settings.telegramWebhookSecret) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }

  // Verify the secret token header
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== settings.telegramWebhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = await req.json();
  const msg = update.message;
  if (!msg?.text) {
    return NextResponse.json({ ok: true });
  }

  // Store the message
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

  // Auto-reply if enabled
  if (settings.telegramAutoReply) {
    const isDM = msg.chat.type === "private";
    const client = new TelegramClient(decrypt(settings.telegramBotToken));

    // Check if bot is mentioned in group chats
    let isMentioned = isDM;
    if (!isDM && msg.entities) {
      try {
        const bot = await client.validateConnection();
        const botUsername = bot.username?.toLowerCase();
        if (botUsername) {
          for (const entity of msg.entities) {
            if (entity.type === "mention") {
              const mentionText = msg.text
                .substring(entity.offset, entity.offset + entity.length)
                .toLowerCase();
              if (mentionText === `@${botUsername}`) {
                isMentioned = true;
                break;
              }
            }
          }
        }
      } catch {
        // If getMe fails, skip mention check
      }
    }

    if (isMentioned) {
      try {
        const systemPrompt =
          settings.telegramBotPrompt ||
          "You are a helpful assistant in a Telegram chat. Keep responses concise and friendly. Do not use Markdown formatting.";

        const model = await getModelInstance();
        const { text: reply } = await generateText({
          model,
          system: systemPrompt,
          prompt: `User "${msg.from?.first_name || "Someone"}" says: ${msg.text}`,
          maxOutputTokens: 1024,
        });

        await client.sendMessage(msg.chat.id, reply);

        // Store bot reply in DB
        await prisma.telegramMessage.create({
          data: {
            chatId: msg.chat.id,
            chatTitle: msg.chat.title || msg.from?.first_name || null,
            chatType: msg.chat.type,
            fromName: "Bot",
            fromUsername: null,
            text: reply,
            isBot: true,
            sentAt: new Date(),
          },
        });
      } catch (err) {
        console.error("[Webhook/Telegram] Auto-reply error:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
