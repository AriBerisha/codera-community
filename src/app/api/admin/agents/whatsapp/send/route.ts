import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";
import { sendWhatsAppMessage, isConnected } from "@/lib/whatsapp/session";

/** POST — Send a WhatsApp message from the linked account to a specific chat. */
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

  if (!isConnected()) {
    return NextResponse.json(
      { error: "WhatsApp is not connected" },
      { status: 400 }
    );
  }

  try {
    const { messageId } = await sendWhatsAppMessage(chatId, message);

    const existing = await prisma.whatsAppMessage.findFirst({
      where: { chatId, chatTitle: { not: null } },
      select: { chatTitle: true, chatType: true },
    });

    await prisma.whatsAppMessage.create({
      data: {
        messageId,
        chatId,
        chatTitle: existing?.chatTitle ?? null,
        chatType: existing?.chatType ?? (chatId.endsWith("@g.us") ? "group" : "private"),
        fromName: "Bot",
        fromNumber: null,
        text: message,
        isBot: true,
        sentAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, messageId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send" },
      { status: 400 }
    );
  }
}
