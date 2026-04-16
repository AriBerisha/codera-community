import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { isAdminRole } from "@/lib/auth-utils";
import { TelegramClient } from "@/lib/telegram/client";

/** POST — Send a message from the bot to a specific chat. */
export async function POST(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { chatId, message } = await req.json();

  if (!chatId || !message) {
    return NextResponse.json(
      { error: "chatId and message are required" },
      { status: 400 }
    );
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.telegramBotToken) {
    return NextResponse.json(
      { error: "Telegram bot not connected" },
      { status: 400 }
    );
  }

  try {
    const client = new TelegramClient(decrypt(settings.telegramBotToken));
    const result = await client.sendMessage(chatId, message);

    // Store the bot message in DB
    const stored = await prisma.telegramMessage.create({
      data: {
        chatId: BigInt(chatId),
        chatTitle: null, // will be filled from existing chat context
        chatType: "unknown",
        fromName: "Bot",
        fromUsername: null,
        text: message,
        isBot: true,
        sentAt: new Date(),
      },
    });

    // Try to update chatTitle and chatType from existing messages in same chat
    const existing = await prisma.telegramMessage.findFirst({
      where: { chatId: BigInt(chatId), chatTitle: { not: null } },
      select: { chatTitle: true, chatType: true },
    });

    if (existing) {
      await prisma.telegramMessage.update({
        where: { id: stored.id },
        data: {
          chatTitle: existing.chatTitle,
          chatType: existing.chatType,
        },
      });
    }

    return NextResponse.json({
      success: true,
      messageId: result.message_id,
    });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Failed to send message";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
