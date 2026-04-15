import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** DELETE — clear all conversations for the current user. */
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count } = await prisma.conversation.deleteMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ deleted: count });
}
