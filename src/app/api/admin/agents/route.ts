import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";

/** GET — list connected social agents. */
export async function GET() {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  const agents: Array<{
    id: string;
    name: string;
    platform: string;
    connected: boolean;
  }> = [];

  agents.push({
    id: "telegram",
    name: "Telegram",
    platform: "telegram",
    connected: !!settings?.telegramBotToken,
  });

  agents.push({
    id: "whatsapp",
    name: "WhatsApp",
    platform: "whatsapp",
    connected: !!settings?.whatsappAuthState,
  });

  return NextResponse.json(agents);
}
