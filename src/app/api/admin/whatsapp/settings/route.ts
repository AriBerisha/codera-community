import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";

/** PATCH — Update WhatsApp agent settings (auto-reply + prompt). */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.autoReply === "boolean") {
    data.whatsappAutoReply = body.autoReply;
  }
  if (typeof body.botPrompt === "string") {
    data.whatsappBotPrompt = body.botPrompt || null;
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
