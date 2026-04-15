import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { ResendClient } from "@/lib/resend/client";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { apiKey, fromEmail } = await req.json();

  if (!apiKey || !fromEmail) {
    return NextResponse.json(
      { error: "API key and From email are required" },
      { status: 400 }
    );
  }

  try {
    const client = new ResendClient(apiKey);
    await client.validateConnection();

    await prisma.appSettings.upsert({
      where: { id: "default" },
      update: {
        resendApiKey: encrypt(apiKey),
        resendFromEmail: fromEmail,
      },
      create: {
        id: "default",
        setupCompleted: true,
        resendApiKey: encrypt(apiKey),
        resendFromEmail: fromEmail,
      },
    });

    return NextResponse.json({ success: true, fromEmail });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
