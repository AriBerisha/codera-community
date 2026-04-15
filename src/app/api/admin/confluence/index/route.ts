import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ConfluenceClient } from "@/lib/confluence/client";
import { indexConfluenceSpace } from "@/lib/confluence/indexer";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { spaceId } = await req.json();

  if (!spaceId) {
    return NextResponse.json(
      { error: "Space ID is required" },
      { status: 400 }
    );
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.confluenceUrl || !settings?.confluenceEmail || !settings?.confluenceApiToken) {
    return NextResponse.json(
      { error: "Confluence is not configured" },
      { status: 400 }
    );
  }

  await prisma.confluenceSpace.update({
    where: { id: spaceId },
    data: { indexStatus: "INDEXING" },
  });

  const confluenceUrl = settings.confluenceUrl;
  const confluenceEmail = settings.confluenceEmail;
  const confluenceApiToken = decrypt(settings.confluenceApiToken);

  after(async () => {
    try {
      const client = new ConfluenceClient(confluenceUrl, confluenceEmail, confluenceApiToken);
      await indexConfluenceSpace(spaceId, client);
    } catch (error) {
      console.error("Confluence indexing failed:", error);
      await prisma.confluenceSpace.update({
        where: { id: spaceId },
        data: { indexStatus: "FAILED" },
      });
    }
  });

  return NextResponse.json({ success: true, message: "Indexing started" });
}
