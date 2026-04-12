import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; changeId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, changeId } = await params;
  const { status } = await req.json();

  // Verify ownership
  const change = await prisma.fileChange.findFirst({
    where: {
      id: changeId,
      conversationId: id,
      conversation: { userId: session.user.id },
    },
  });

  if (!change) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.fileChange.update({
    where: { id: changeId },
    data: { status },
  });

  return NextResponse.json(updated);
}
