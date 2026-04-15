import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { SharePointClient } from "@/lib/sharepoint/client";
import { indexSharePointSite } from "@/lib/sharepoint/indexer";
import { isAdminRole } from "@/lib/auth-utils";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId } = await req.json();

  if (!siteId) {
    return NextResponse.json(
      { error: "Site ID is required" },
      { status: 400 }
    );
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  if (
    !settings?.sharepointTenantId ||
    !settings?.sharepointClientId ||
    !settings?.sharepointClientSecret
  ) {
    return NextResponse.json(
      { error: "SharePoint is not configured" },
      { status: 400 }
    );
  }

  await prisma.sharePointSite.update({
    where: { id: siteId },
    data: { indexStatus: "INDEXING" },
  });

  const tenantId = settings.sharepointTenantId;
  const clientId = settings.sharepointClientId;
  const clientSecret = decrypt(settings.sharepointClientSecret);

  after(async () => {
    try {
      const client = new SharePointClient(tenantId, clientId, clientSecret);
      await indexSharePointSite(siteId, client);
    } catch (error) {
      console.error("SharePoint indexing failed:", error);
      await prisma.sharePointSite.update({
        where: { id: siteId },
        data: { indexStatus: "FAILED" },
      });
    }
  });

  return NextResponse.json({ success: true, message: "Indexing started" });
}
