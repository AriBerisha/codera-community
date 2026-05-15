import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";

/** PATCH — update an existing memory. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; memoryId: string }> }
) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: teamId, memoryId } = await params;
  const body = await req.json();

  const data: { title?: string | null; content?: string } = {};

  if (body.title !== undefined) {
    const t = typeof body.title === "string" ? body.title.trim() : "";
    data.title = t || null;
  }

  if (body.content !== undefined) {
    if (typeof body.content !== "string" || body.content.trim().length === 0) {
      return NextResponse.json(
        { error: "Memory content cannot be empty" },
        { status: 400 }
      );
    }
    data.content = body.content.trim();
  }

  // Make sure the memory belongs to the team in the URL.
  const existing = await prisma.teamMemory.findFirst({
    where: { id: memoryId, teamId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Memory not found in this team" },
      { status: 404 }
    );
  }

  const memory = await prisma.teamMemory.update({
    where: { id: memoryId },
    data,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(memory);
}

/** DELETE — remove a memory. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; memoryId: string }> }
) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: teamId, memoryId } = await params;

  const existing = await prisma.teamMemory.findFirst({
    where: { id: memoryId, teamId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Memory not found in this team" },
      { status: 404 }
    );
  }

  await prisma.teamMemory.delete({ where: { id: memoryId } });

  return NextResponse.json({ success: true });
}
