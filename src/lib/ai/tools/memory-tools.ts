import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canAccessTeamMemories,
  listAccessibleTeamIds,
} from "@/lib/teams/memories";

const MAX_MEMORIES_RETURNED = 50;

/**
 * Build a short summary of memories across the user's teams to append to the
 * system prompt. Lets the model know what memory exists without using a tool
 * call. Empty if the user is in no teams or no memories exist.
 */
export async function buildTeamMemoriesDirectory(options: {
  userId: string;
  userRole: string;
}): Promise<string> {
  const teamIds = await listAccessibleTeamIds(options.userId, options.userRole);
  if (teamIds.length === 0) return "";

  const memories = await prisma.teamMemory.findMany({
    where: { teamId: { in: teamIds } },
    orderBy: { createdAt: "desc" },
    take: MAX_MEMORIES_RETURNED,
    select: {
      id: true,
      title: true,
      teamId: true,
      team: { select: { name: true } },
    },
  });

  if (memories.length === 0) return "";

  const lines = [
    "\n\nTeam memories available (call read_team_memory to fetch content, or save_team_memory to add new ones):",
  ];
  for (const m of memories) {
    const label = m.title?.trim() || "(untitled)";
    lines.push(`- [${m.team.name}] ${label} — id: ${m.id}`);
  }
  return lines.join("\n");
}

export function buildMemoryTools(options: {
  userId: string;
  userRole: string;
}): ToolSet {
  return {
    read_team_memory: tool({
      description:
        "Read team memories — durable notes the team has saved as knowledge. " +
        "Use this when the user's question may benefit from prior team context " +
        "(decisions, conventions, who-does-what, ongoing initiatives). " +
        "Pass a teamId to scope to a specific team, or leave it blank to " +
        "retrieve recent memories across all of the user's teams. " +
        "Pass a memoryId to fetch a single memory's full content.",
      inputSchema: z.object({
        teamId: z
          .string()
          .optional()
          .describe("Restrict to one team. Omit to search across all of the user's teams."),
        memoryId: z
          .string()
          .optional()
          .describe("Fetch a single memory by id (returned in full)."),
        query: z
          .string()
          .optional()
          .describe(
            "Optional case-insensitive substring filter against title and content."
          ),
      }),
      execute: async ({ teamId, memoryId, query }) => {
        if (memoryId) {
          const m = await prisma.teamMemory.findUnique({
            where: { id: memoryId },
            include: { team: { select: { id: true, name: true } } },
          });
          if (!m) return { memories: [], error: "Memory not found" };
          const ok = await canAccessTeamMemories(
            options.userId,
            options.userRole,
            m.teamId
          );
          if (!ok) {
            return { memories: [], error: "You are not a member of this team" };
          }
          return {
            memories: [
              {
                id: m.id,
                teamId: m.teamId,
                teamName: m.team.name,
                title: m.title,
                content: m.content,
                createdAt: m.createdAt.toISOString(),
              },
            ],
          };
        }

        let teamIds: string[];
        if (teamId) {
          const ok = await canAccessTeamMemories(
            options.userId,
            options.userRole,
            teamId
          );
          if (!ok) {
            return { memories: [], error: "You are not a member of this team" };
          }
          teamIds = [teamId];
        } else {
          teamIds = await listAccessibleTeamIds(
            options.userId,
            options.userRole
          );
          if (teamIds.length === 0) {
            return { memories: [], note: "User is not in any teams" };
          }
        }

        const q = query?.trim();
        const memories = await prisma.teamMemory.findMany({
          where: {
            teamId: { in: teamIds },
            ...(q
              ? {
                  OR: [
                    { title: { contains: q, mode: "insensitive" } },
                    { content: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          take: MAX_MEMORIES_RETURNED,
          include: { team: { select: { id: true, name: true } } },
        });

        return {
          memories: memories.map((m) => ({
            id: m.id,
            teamId: m.teamId,
            teamName: m.team.name,
            title: m.title,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          })),
        };
      },
    }),

    save_team_memory: tool({
      description:
        "Save a new memory to a team's durable knowledge base. Call this when " +
        "the conversation surfaces something worth remembering across future " +
        "sessions: a decision, a convention, who owns what, an ongoing project " +
        "constraint, a glossary entry. Keep entries focused — one fact or " +
        "decision per memory. Always provide a teamId; pick the most relevant " +
        "team the user belongs to.",
      inputSchema: z.object({
        teamId: z
          .string()
          .describe("Id of the team this memory belongs to. Required."),
        title: z
          .string()
          .optional()
          .describe(
            "Short title (a few words). Helps humans skim later. Optional but recommended."
          ),
        content: z
          .string()
          .min(1)
          .describe(
            "The memory body. Self-contained — don't reference the current chat or 'us'; write it as durable knowledge."
          ),
      }),
      execute: async ({ teamId, title, content }) => {
        const ok = await canAccessTeamMemories(
          options.userId,
          options.userRole,
          teamId
        );
        if (!ok) {
          return {
            success: false,
            error: "You are not a member of this team",
          };
        }
        const memory = await prisma.teamMemory.create({
          data: {
            teamId,
            title: title?.trim() || null,
            content: content.trim(),
            createdById: options.userId,
          },
        });
        return {
          success: true,
          memoryId: memory.id,
          message: "Memory saved to the team's knowledge base.",
        };
      },
    }),
  };
}
