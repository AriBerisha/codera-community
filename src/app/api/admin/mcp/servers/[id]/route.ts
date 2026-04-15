import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { isAdminRole } from "@/lib/auth-utils";

/** PATCH — update an MCP server. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.url !== undefined) data.url = body.url;
  if (body.apiKey !== undefined) {
    data.apiKey = body.apiKey ? encrypt(body.apiKey) : null;
  }
  if (body.headers !== undefined) data.headers = body.headers;
  if (body.enabled !== undefined) data.enabled = body.enabled;

  const server = await prisma.mcpServer.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    ...server,
    apiKey: server.apiKey ? "••••••••" : null,
  });
}

/** DELETE — remove an MCP server. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  await prisma.mcpServer.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
