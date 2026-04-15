import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

/** GET — list all MCP servers. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const servers = await prisma.mcpServer.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Mask API keys in the response
  const masked = servers.map((s) => ({
    ...s,
    apiKey: s.apiKey ? "••••••••" : null,
  }));

  return NextResponse.json(masked);
}

/** POST — add a new MCP server. */
export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, url, apiKey, headers } = await req.json();

  if (!name || !url) {
    return NextResponse.json(
      { error: "Name and URL are required" },
      { status: 400 }
    );
  }

  const server = await prisma.mcpServer.create({
    data: {
      name,
      url,
      apiKey: apiKey ? encrypt(apiKey) : null,
      headers: headers ?? null,
    },
  });

  return NextResponse.json(
    { ...server, apiKey: server.apiKey ? "••••••••" : null },
    { status: 201 }
  );
}
