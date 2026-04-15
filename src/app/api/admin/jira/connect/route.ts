import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { JiraClient } from "@/lib/jira/client";
import { isAdminRole } from "@/lib/auth-utils";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { jiraUrl, email, apiToken } = await req.json();

  if (!jiraUrl || !email || !apiToken) {
    return NextResponse.json(
      { error: "Jira URL, email, and API token are required" },
      { status: 400 }
    );
  }

  try {
    const client = new JiraClient(jiraUrl, email, apiToken);

    // Validate credentials
    const user = await client.validateConnection();

    // Save settings
    await prisma.appSettings.upsert({
      where: { id: "default" },
      update: {
        jiraUrl,
        jiraEmail: email,
        jiraApiToken: encrypt(apiToken),
      },
      create: {
        id: "default",
        setupCompleted: true,
        jiraUrl,
        jiraEmail: email,
        jiraApiToken: encrypt(apiToken),
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
