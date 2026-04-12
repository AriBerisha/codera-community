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

  const { changeId } = await params;
  const { status, modifiedContent } = await req.json();

  const change = await prisma.fileChange.update({
    where: { id: changeId },
    data: {
      ...(status !== undefined && { status }),
      ...(modifiedContent !== undefined && { modifiedContent }),
    },
  });

  return NextResponse.json(change);
}
