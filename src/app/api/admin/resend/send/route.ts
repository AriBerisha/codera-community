import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ResendClient } from "@/lib/resend/client";

/** POST — send a test email. */
export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { to, subject, text } = await req.json();

  if (!to || !subject) {
    return NextResponse.json(
      { error: "Recipient and subject are required" },
      { status: 400 }
    );
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.resendApiKey || !settings?.resendFromEmail) {
    return NextResponse.json(
      { error: "Resend is not configured" },
      { status: 400 }
    );
  }

  try {
    const client = new ResendClient(decrypt(settings.resendApiKey));
    const result = await client.sendEmail({
      from: settings.resendFromEmail,
      to,
      subject,
      text: text || "",
    });

    return NextResponse.json({ success: true, emailId: result.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
