import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { isAdminRole } from "@/lib/auth-utils";
import { TelegramClient } from "@/lib/telegram/client";

/** POST — send a test message to a Telegram chat. */
export async function POST(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { chatId, message } = await req.json();

  if (!chatId || !message) {
    return NextResponse.json(
      { error: "Chat ID and message are required" },
      { status: 400 }
    );
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.telegramBotToken) {
    return NextResponse.json(
      { error: "Telegram is not configured" },
      { status: 400 }
    );
  }

  try {
    const client = new TelegramClient(decrypt(settings.telegramBotToken));
    await client.sendMessage(chatId, message);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
