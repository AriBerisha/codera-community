import { streamText, convertToModelMessages } from "ai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getModelInstance } from "@/lib/ai/providers";
import { buildCodeContext } from "@/lib/ai/code-context";
import { buildJiraContext } from "@/lib/ai/jira-context";
import { buildConfluenceContext } from "@/lib/ai/confluence-context";
import { buildSharePointContext } from "@/lib/ai/sharepoint-context";
import { buildMcpContext } from "@/lib/ai/mcp-context";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { parseFileEdits, applyEdit } from "@/lib/ai/parse-file-edits";
import { getLanguageFromPath } from "@/lib/gitlab/file-filter";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, conversationId } = await req.json();

  // Load conversation to get selected projectIds
  let projectIds: string[] = [];
  if (conversationId) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId, userId: session.user.id },
    });
    if (conversation) {
      projectIds = conversation.projectIds;
    }
  }

  // Load selected projects from both GitLab and GitHub
  let selectedProjects: Array<{ id: string; pathWithNamespace: string; name: string }> = [];
  if (projectIds.length > 0) {
    const [glProjects, ghProjects] = await Promise.all([
      prisma.gitlabProject.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, pathWithNamespace: true, name: true },
      }),
      prisma.githubProject.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, fullName: true, name: true },
      }),
    ]);
    selectedProjects = [
      ...glProjects,
      ...ghProjects.map((p) => ({ id: p.id, pathWithNamespace: p.fullName, name: p.name })),
    ];
  }

  // Extract user text from the latest message (UIMessage format has parts[])
  const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === "user");
  const userContent = lastUserMessage?.parts
    ?.filter((p: { type: string }) => p.type === "text")
    .map((p: { text: string }) => p.text)
    .join("") || lastUserMessage?.content || "";

  // Save user message to DB
  if (conversationId && lastUserMessage) {
    await prisma.message.create({
      data: {
        conversationId,
        userId: session.user.id,
        role: "USER",
        content: userContent,
      },
    });

    // Update conversation title from first message
    const msgCount = await prisma.message.count({
      where: { conversationId },
    });
    if (msgCount === 1) {
      const title =
        userContent.length > 50
          ? userContent.substring(0, 50) + "..."
          : userContent;
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title, updatedAt: new Date() },
      });
    } else {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }
  }

  // Build code context from indexed files + Jira issues
  const [codeContext, jiraContext, confluenceContext, sharepointContext, mcpContext] = await Promise.all([
    buildCodeContext(userContent, projectIds),
    buildJiraContext(userContent),
    buildConfluenceContext(userContent),
    buildSharePointContext(userContent),
    buildMcpContext(userContent),
  ]);
  const projectPaths = selectedProjects.map(p => p.pathWithNamespace);
  const systemPrompt = buildSystemPrompt(codeContext + jiraContext + confluenceContext + sharepointContext + mcpContext, projectPaths);

  // Get the configured AI model
  const model = await getModelInstance();

  // Convert UI messages to model messages (AI SDK v6 requirement)
  const modelMessages = await convertToModelMessages(messages);

  // Stream the response
  const result = streamText({
    model,
    system: systemPrompt,
    messages: modelMessages,
    maxOutputTokens: 8192,
    async onFinish({ text }) {
      if (conversationId) {
        await prisma.message.create({
          data: {
            conversationId,
            role: "ASSISTANT",
            content: text,
          },
        });

        // Parse file edits and create FileChange records
        const edits = parseFileEdits(text);
        if (edits.length > 0) {
          console.log(`[Chat] Parsed ${edits.length} file edits from response`);
          for (const edit of edits) {
            try {
              const editProjectLower = edit.project.toLowerCase().trim();
              let project = selectedProjects.find(
                p => p.pathWithNamespace.toLowerCase() === editProjectLower
              ) || selectedProjects.find(
                p => p.name.toLowerCase() === editProjectLower
                  || p.pathWithNamespace.toLowerCase().endsWith("/" + editProjectLower)
                  || editProjectLower.endsWith("/" + p.name.toLowerCase())
              );
              if (!project && selectedProjects.length === 1) {
                project = selectedProjects[0];
              }
              if (!project) {
                console.error("[Chat] Could not match project:", edit.project);
                continue;
              }

              const existing = await prisma.fileChange.findUnique({
                where: {
                  conversationId_projectId_filePath: {
                    conversationId,
                    projectId: project.id,
                    filePath: edit.filePath,
                  },
                },
              });

              if (existing) {
                const newModified = applyEdit(existing.modifiedContent, edit.original, edit.modified);
                await prisma.fileChange.update({
                  where: { id: existing.id },
                  data: { modifiedContent: newModified, status: "PENDING" },
                });
              } else {
                const indexed = await prisma.indexedFile.findFirst({
                  where: { projectId: project.id, filePath: edit.filePath },
                });
                const originalContent = indexed?.content || "";
                const modifiedContent = applyEdit(originalContent, edit.original, edit.modified);

                await prisma.fileChange.create({
                  data: {
                    conversationId,
                    projectId: project.id,
                    filePath: edit.filePath,
                    originalContent,
                    modifiedContent,
                    language: getLanguageFromPath(edit.filePath),
                  },
                });
              }
            } catch (err) {
              console.error("[Chat] Failed to process edit:", edit.filePath, err);
            }
          }
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
