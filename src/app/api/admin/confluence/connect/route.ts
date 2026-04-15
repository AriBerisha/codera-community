import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { ConfluenceClient } from "@/lib/confluence/client";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { confluenceUrl, email, apiToken } = await req.json();

  if (!confluenceUrl || !email || !apiToken) {
    return NextResponse.json(
      { error: "Confluence URL, email, and API token are required" },
      { status: 400 }
    );
  }

  try {
    const client = new ConfluenceClient(confluenceUrl, email, apiToken);
    const user = await client.validateConnection();

    await prisma.appSettings.upsert({
      where: { id: "default" },
      update: {
        confluenceUrl,
        confluenceEmail: email,
        confluenceApiToken: encrypt(apiToken),
      },
      create: {
        id: "default",
        setupCompleted: true,
        confluenceUrl,
        confluenceEmail: email,
        confluenceApiToken: encrypt(apiToken),
      },
    });

    return NextResponse.json({
      success: true,
      user: { accountId: user.accountId, displayName: user.displayName },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
