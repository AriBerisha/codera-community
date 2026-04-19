import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";
import { getSessionState } from "@/lib/whatsapp/session";

/** GET — Return persisted WhatsApp chats + live session state. */
export async function GET() {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: {
      whatsappConnected: true,
      whatsappLinkedPhone: true,
      whatsappLinkedName: true,
    },
  });

  const state = getSessionState();
  const isConnected = state.status === "connected" || !!settings?.whatsappConnected;

  if (!isConnected) {
    return NextResponse.json({ connected: false, chats: [] });
  }

  const messages = await prisma.whatsAppMessage.findMany({
    orderBy: { sentAt: "asc" },
  });

  type ChatEntry = {
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
  };

  const chatMap = new Map<string, ChatEntry>();
  for (const msg of messages) {
    if (!chatMap.has(msg.chatId)) {
      chatMap.set(msg.chatId, {
        id: msg.chatId,
        title: msg.chatTitle || msg.chatId.split("@")[0],
        type: msg.chatType,
        messages: [],
      });
    }
    chatMap.get(msg.chatId)!.messages.push({
      id: msg.id,
      from: msg.fromName,
      username: msg.fromNumber,
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
    live: state.status === "connected",
    account: {
      name: state.linkedName ?? settings?.whatsappLinkedName ?? null,
      phone: state.linkedPhone ?? settings?.whatsappLinkedPhone ?? null,
    },
    chats,
  });
}
