import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { isAdminRole } from "@/lib/auth-utils";
import { TelegramClient } from "@/lib/telegram/client";
import { syncTelegramAndReply } from "@/lib/telegram/sync";

/** GET — sync new messages from Telegram, then return all from DB. */
export async function GET() {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.telegramBotToken) {
    return NextResponse.json({ connected: false, chats: [] });
  }

  let botInfo: { name: string; username?: string } | undefined;

  try {
    const client = new TelegramClient(decrypt(settings.telegramBotToken));
    const bot = await client.validateConnection();
    botInfo = { name: bot.first_name, username: bot.username };

    // Sync messages + auto-reply (shared logic)
    await syncTelegramAndReply();
  } catch (err) {
    console.error("[Agents/Telegram] Sync error:", err);
  }

  // Read all messages from DB, grouped by chat
  const messages = await prisma.telegramMessage.findMany({
    orderBy: { sentAt: "asc" },
  });

  const chatMap = new Map<
    string,
    {
      id: string;
      title: string;
      type: string;
      messages: Array<{
        id: string;
        from: string;
        username: string | null;
        text: string;
        date: string;
        isBot: boolean;
      }>;
    }
  >();

  for (const msg of messages) {
    const chatKey = msg.chatId.toString();
    if (!chatMap.has(chatKey)) {
      chatMap.set(chatKey, {
        id: chatKey,
        title: msg.chatTitle || `Chat ${chatKey}`,
        type: msg.chatType,
        messages: [],
      });
    }
    chatMap.get(chatKey)!.messages.push({
      id: msg.id,
      from: msg.fromName,
      username: msg.fromUsername,
      text: msg.text,
      date: msg.sentAt.toISOString(),
      isBot: msg.isBot,
    });
  }

  const chats = Array.from(chatMap.values()).sort((a, b) => {
    const aLast = a.messages[a.messages.length - 1]?.date || "";
    const bLast = b.messages[b.messages.length - 1]?.date || "";
    return bLast.localeCompare(aLast);
  });

  return NextResponse.json({
    connected: true,
    bot: botInfo,
    chats,
  });
}
