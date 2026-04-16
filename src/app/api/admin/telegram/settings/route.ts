import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";

/** GET — Return current Telegram settings (non-secret fields). */
export async function GET() {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: {
      telegramBotToken: true,
      telegramAutoReply: true,
      telegramBotPrompt: true,
      telegramWebhookSecret: true,
    },
  });

  return NextResponse.json({
    connected: !!settings?.telegramBotToken,
    autoReply: settings?.telegramAutoReply ?? false,
    botPrompt: settings?.telegramBotPrompt ?? "",
    webhookConfigured: !!settings?.telegramWebhookSecret,
  });
}

/** PATCH — Update Telegram agent settings. */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.autoReply === "boolean") {
    data.telegramAutoReply = body.autoReply;
  }
  if (typeof body.botPrompt === "string") {
    data.telegramBotPrompt = body.botPrompt || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await prisma.appSettings.update({
    where: { id: "default" },
    data,
  });

  return NextResponse.json({ success: true });
}
