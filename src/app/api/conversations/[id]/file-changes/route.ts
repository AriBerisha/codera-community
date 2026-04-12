import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const changes = await prisma.fileChange.findMany({
    where: {
      conversationId: id,
      conversation: { userId: session.user.id },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(changes);
}
