import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";

/** POST — add a member to a team. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: teamId } = await params;
  const { userId, role } = await req.json();

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  const VALID_TEAM_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
  if (role !== undefined && !VALID_TEAM_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `Role must be one of ${VALID_TEAM_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  // Check team exists
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Check user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // PENDING users have no permissions until an admin approves them. Adding
  // them to a team would grant integration access via the team — refuse.
  if (user.role === "PENDING") {
    return NextResponse.json(
      { error: "Approve this user from the Users page before adding them to a team" },
      { status: 400 }
    );
  }

  // Check if already a member
  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "User is already a member of this team" },
      { status: 409 }
    );
  }

  const member = await prisma.teamMember.create({
    data: {
      teamId,
      userId,
      role: role || "MEMBER",
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return NextResponse.json(member, { status: 201 });
}
