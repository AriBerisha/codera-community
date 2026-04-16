import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { isAdminRole } from "@/lib/auth-utils";
import { TelegramClient } from "@/lib/telegram/client";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { botToken } = await req.json();

  if (!botToken) {
    return NextResponse.json(
      { error: "Bot token is required" },
      { status: 400 }
    );
  }

  try {
    const client = new TelegramClient(botToken);
    const bot = await client.validateConnection();

    // Generate a webhook secret for verification
    const webhookSecret = randomUUID();
    let webhookSet = false;

    // Try to set webhook if we have a public URL
    const appUrl = process.env.NEXTAUTH_URL || "";
    if (appUrl && !appUrl.includes("localhost") && !appUrl.includes("127.0.0.1")) {
      try {
        const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/webhooks/telegram`;
        await client.setWebhook(webhookUrl, webhookSecret);
        webhookSet = true;
        console.log(`[Telegram] Webhook set: ${webhookUrl}`);
      } catch (err) {
        console.warn("[Telegram] Failed to set webhook, falling back to polling:", err);
        await client.deleteWebhook();
      }
    } else {
      // Local dev — use polling
      await client.deleteWebhook();
    }

    await prisma.appSettings.upsert({
      where: { id: "default" },
      update: {
        telegramBotToken: encrypt(botToken),
        telegramWebhookSecret: webhookSecret,
      },
      create: {
        id: "default",
        setupCompleted: true,
        telegramBotToken: encrypt(botToken),
        telegramWebhookSecret: webhookSecret,
      },
    });

    return NextResponse.json({
      success: true,
      webhookSet,
      bot: {
        id: bot.id,
        name: bot.first_name,
        username: bot.username,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
