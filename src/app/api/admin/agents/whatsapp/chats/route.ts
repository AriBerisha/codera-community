import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

/** GET — Return unique WhatsApp chats (for automation chat selection). */
export async function GET() {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await prisma.whatsAppMessage.findMany({
    distinct: ["chatId"],
    orderBy: { sentAt: "desc" },
    select: {
      chatId: true,
      chatTitle: true,
      chatType: true,
    },
  });

  const chats = messages.map((m) => ({
    id: m.chatId,
    title: m.chatTitle || m.chatId.split("@")[0],
    type: m.chatType,
  }));

  return NextResponse.json(chats);
}
