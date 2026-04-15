import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";

/** PATCH — update member role. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { memberId } = await params;
  const { role } = await req.json();

  if (!role || !["OWNER", "ADMIN", "MEMBER"].includes(role)) {
    return NextResponse.json(
      { error: "Valid role is required (OWNER, ADMIN, MEMBER)" },
      { status: 400 }
    );
  }

  const member = await prisma.teamMember.update({
    where: { id: memberId },
    data: { role },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return NextResponse.json(member);
}

/** DELETE — remove member from team. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { memberId } = await params;

  await prisma.teamMember.delete({ where: { id: memberId } });

  return NextResponse.json({ success: true });
}
