import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { SharePointClient } from "@/lib/sharepoint/client";
import { isAdminRole } from "@/lib/auth-utils";

export async function GET(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const localOnly = searchParams.get("local") === "true";

  if (!localOnly) {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    });

    if (
      !settings?.sharepointTenantId ||
      !settings?.sharepointClientId ||
      !settings?.sharepointClientSecret
    ) {
      // Not configured yet — skip sync, just return local data
    } else try {
      const client = new SharePointClient(
        settings.sharepointTenantId,
        settings.sharepointClientId,
        decrypt(settings.sharepointClientSecret)
      );
      const sites = await client.listSites();

      for (const s of sites) {
        await prisma.sharePointSite.upsert({
          where: { siteId: s.id },
          update: {
            name: s.name,
            displayName: s.displayName,
            webUrl: s.webUrl,
          },
          create: {
            siteId: s.id,
            name: s.name,
            displayName: s.displayName,
            webUrl: s.webUrl,
          },
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch sites";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const sites = await prisma.sharePointSite.findMany({
    orderBy: { displayName: "asc" },
    include: { _count: { select: { files: true } } },
  });

  return NextResponse.json(
    sites.map((s) => ({ ...s, source: "sharepoint" as const }))
  );
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId, included } = await req.json();

  const site = await prisma.sharePointSite.update({
    where: { id: siteId },
    data: { included },
  });

  return NextResponse.json(site);
}
