import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";
import { getSessionState, startSession } from "@/lib/whatsapp/session";

/** GET — Return live session state + persisted settings. Polled by the UI while pairing. */
export async function GET() {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let state = getSessionState();
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: {
      whatsappConnected: true,
      whatsappAuthState: true,
      whatsappLinkedPhone: true,
      whatsappLinkedName: true,
      whatsappAutoReply: true,
      whatsappBotPrompt: true,
    },
  });

  // Auto-recover: if we have saved auth but the in-memory session is dead
  // (instrumentation never ran, HMR orphaned it, or the process was recycled),
  // kick off a reconnect so the next poll sees it online.
  if (state.status === "disconnected" && settings?.whatsappAuthState) {
    startSession().catch((err) =>
      console.error("[whatsapp] auto-recover failed", err)
    );
    state = getSessionState();
  }

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
