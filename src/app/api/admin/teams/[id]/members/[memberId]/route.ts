import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";

const VALID_TEAM_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;

/** PATCH — update member role. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: teamId, memberId } = await params;
  const { role } = await req.json();

  if (!role || !VALID_TEAM_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `Role must be one of ${VALID_TEAM_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  // Make sure the member exists AND belongs to the team in the URL. Without
  // this we'd happily mutate a row in another team if memberId is valid.
  const existing = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Member not found in this team" }, { status: 404 });
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

  const { id: teamId, memberId } = await params;

  const existing = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Member not found in this team" }, { status: 404 });
  }

  await prisma.teamMember.delete({ where: { id: memberId } });

  return NextResponse.json({ success: true });
}
