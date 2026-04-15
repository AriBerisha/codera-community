import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ConfluenceClient } from "@/lib/confluence/client";
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

    if (!settings?.confluenceUrl || !settings?.confluenceEmail || !settings?.confluenceApiToken) {
      return NextResponse.json(
        { error: "Confluence is not configured" },
        { status: 400 }
      );
    }

    try {
      const client = new ConfluenceClient(
        settings.confluenceUrl,
        settings.confluenceEmail,
        decrypt(settings.confluenceApiToken)
      );
      const spaces = await client.listSpaces();

      for (const s of spaces) {
        await prisma.confluenceSpace.upsert({
          where: { confluenceId: s.id },
          update: {
            key: s.key,
            name: s.name,
            description: s.description?.plain?.value || null,
            webUrl: client.spaceUrl(s.key),
          },
          create: {
            confluenceId: s.id,
            key: s.key,
            name: s.name,
            description: s.description?.plain?.value || null,
            webUrl: client.spaceUrl(s.key),
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch spaces";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const spaces = await prisma.confluenceSpace.findMany({
    orderBy: { key: "asc" },
    include: { _count: { select: { pages: true } } },
  });

  return NextResponse.json(
    spaces.map((s) => ({ ...s, source: "confluence" as const }))
  );
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { spaceId, included } = await req.json();

  const space = await prisma.confluenceSpace.update({
    where: { id: spaceId },
    data: { included },
  });

  return NextResponse.json(space);
}
