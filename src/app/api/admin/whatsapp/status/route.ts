import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";
import { getSessionState } from "@/lib/whatsapp/session";

/** GET — Return live session state + persisted settings. Polled by the UI while pairing. */
export async function GET() {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const state = getSessionState();
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: {
      whatsappConnected: true,
      whatsappLinkedPhone: true,
      whatsappLinkedName: true,
      whatsappAutoReply: true,
      whatsappBotPrompt: true,
    },
  });

  return NextResponse.json({
    status: state.status,
    qr: state.qr,
    linkedPhone: state.linkedPhone ?? settings?.whatsappLinkedPhone ?? null,
    linkedName: state.linkedName ?? settings?.whatsappLinkedName ?? null,
    lastError: state.lastError,
    autoReply: settings?.whatsappAutoReply ?? false,
    botPrompt: settings?.whatsappBotPrompt ?? "",
    persistedConnected: !!settings?.whatsappConnected,
  });
}
