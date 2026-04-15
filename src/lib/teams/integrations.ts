import { prisma } from "@/lib/prisma";

/**
 * Get the set of integrations a user is allowed to access, based on their
 * team memberships.  Returns the union of all `enabledIntegrations` across
 * every team the user belongs to.
 *
 * Admins bypass this check — they always have access to all integrations.
 */
export async function getUserAllowedIntegrations(
  userId: string,
  role: string
): Promise<Set<string> | "all"> {
  if (role === "ADMIN" || role === "OWNER") return "all";

  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    select: {
      team: { select: { enabledIntegrations: true } },
    },
  });

  const allowed = new Set<string>();
  for (const m of memberships) {
    for (const integration of m.team.enabledIntegrations) {
      allowed.add(integration);
    }
  }

  return allowed;
}

/** Check whether a specific integration is allowed for the user. */
export function isIntegrationAllowed(
  allowed: Set<string> | "all",
  integration: string
): boolean {
  if (allowed === "all") return true;
  return allowed.has(integration);
}
