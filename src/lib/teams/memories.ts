import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";

/**
 * Does this user have read/write access to memories of the given team?
 * - ADMIN / OWNER: always yes
 * - Anyone else: only if they're an active TeamMember of that team
 */
export async function canAccessTeamMemories(
  userId: string,
  userRole: string | undefined,
  teamId: string
): Promise<boolean> {
  if (isAdminRole(userRole)) return true;
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { id: true },
  });
  return Boolean(membership);
}

/**
 * List the team ids the user can read memories from. Admins see every team.
 */
export async function listAccessibleTeamIds(
  userId: string,
  userRole: string | undefined
): Promise<string[]> {
  if (isAdminRole(userRole)) {
    const teams = await prisma.team.findMany({ select: { id: true } });
    return teams.map((t) => t.id);
  }
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  return memberships.map((m) => m.teamId);
}
