import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { SharePointClient } from "@/lib/sharepoint/client";
import { isAdminRole } from "@/lib/auth-utils";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tenantId, clientId, clientSecret } = await req.json();

  if (!tenantId || !clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Tenant ID, Client ID, and Client Secret are required" },
      { status: 400 }
    );
  }

  try {
    const client = new SharePointClient(tenantId, clientId, clientSecret);
    const org = await client.validateConnection();

    await prisma.appSettings.upsert({
      where: { id: "default" },
      update: {
        sharepointTenantId: tenantId,
        sharepointClientId: clientId,
        sharepointClientSecret: encrypt(clientSecret),
      },
      create: {
        id: "default",
        setupCompleted: true,
        sharepointTenantId: tenantId,
        sharepointClientId: clientId,
        sharepointClientSecret: encrypt(clientSecret),
      },
    });

    return NextResponse.json({
      success: true,
      organization: org.displayName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
