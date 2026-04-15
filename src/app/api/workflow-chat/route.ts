import { streamText, convertToModelMessages } from "ai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getModelInstance } from "@/lib/ai/providers";
import { buildCodeContext } from "@/lib/ai/code-context";
import { buildJiraContext } from "@/lib/ai/jira-context";
import { buildConfluenceContext } from "@/lib/ai/confluence-context";
import { buildSharePointContext } from "@/lib/ai/sharepoint-context";
import { buildMcpContext } from "@/lib/ai/mcp-context";
import { getPlanningPrompt, getProgrammingPrompt } from "@/lib/ai/workflow-prompts";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { parseFileEdits, applyEdit } from "@/lib/ai/parse-file-edits";
import { getLanguageFromPath } from "@/lib/gitlab/file-filter";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, conversationId, executionId } = await req.json();

  // Load execution
  const execution = await prisma.workflowExecution.findUnique({
    where: { id: executionId, userId: session.user.id },
    include: {
      workflow: { include: { steps: { orderBy: { order: "asc" } } } },
      conversation: true,
    },
  });

  if (!execution) {
    return new Response("Execution not found", { status: 404 });
  }

  const currentStep = execution.workflow.steps[execution.currentStepOrder];
  const projectIds = execution.conversation.projectIds;

  // Extract user content for code search
  const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === "user");
  const userContent = lastUserMessage?.parts
    ?.filter((p: { type: string }) => p.type === "text")
    .map((p: { text: string }) => p.text)
    .join("") || "";

  // Save user message
  if (conversationId && lastUserMessage) {
    await prisma.message.create({
      data: {
        conversationId,
        userId: session.user.id,
        role: "USER",
        content: userContent,
      },
    });
  }

  // Load selected projects for context
  const selectedProjects = projectIds.length > 0
    ? await prisma.gitlabProject.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, pathWithNamespace: true, name: true },
      })
    : [];

  // Build code context + Jira + Confluence + SharePoint context
  const [codeContext, jiraContext, confluenceContext, sharepointContext, mcpContext] = await Promise.all([
    buildCodeContext(userContent, projectIds),
    buildJiraContext(userContent),
    buildConfluenceContext(userContent),
    buildSharePointContext(userContent),
    buildMcpContext(userContent),
  ]);
  const fullContext = codeContext + jiraContext + confluenceContext + sharepointContext + mcpContext;

  // Build step-specific system prompt
  const projectPaths = selectedProjects.map(p => p.pathWithNamespace);
  let systemPrompt: string;
  if (currentStep?.type === "PLANNING") {
    systemPrompt = getPlanningPrompt(fullContext);
  } else if (currentStep?.type === "PROGRAMMING") {
    systemPrompt = getProgrammingPrompt(fullContext, execution.planText || "No plan provided.", projectPaths);
  } else {
    systemPrompt = buildSystemPrompt(fullContext);
  }

  const model = await getModelInstance();
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model,
    system: systemPrompt,
    messages: modelMessages,
    maxOutputTokens: 8192,
    async onFinish({ text }) {
      // Save assistant message
      if (conversationId) {
        await prisma.message.create({
          data: { conversationId, role: "ASSISTANT", content: text },
        });
      }

      // For programming step, parse file edits and create FileChange records
      if (currentStep?.type === "PROGRAMMING") {
        const edits = parseFileEdits(text);
        console.log(`[WorkflowChat] onFinish: parsed ${edits.length} file edits from AI response (${text.length} chars)`);
        if (edits.length === 0 && text.includes("file_edit")) {
          console.warn("[WorkflowChat] Text contains 'file_edit' but regex found no matches. First 500 chars:", text.substring(0, 500));
        }
        for (const edit of edits) {
          try {
            // Find the project by path — try exact match, then partial/name match
            const editProjectLower = edit.project.toLowerCase().trim();
            let project = selectedProjects.find(
              p => p.pathWithNamespace.toLowerCase() === editProjectLower
            ) || selectedProjects.find(
              p => p.name.toLowerCase() === editProjectLower
                || p.pathWithNamespace.toLowerCase().endsWith("/" + editProjectLower)
                || editProjectLower.endsWith("/" + p.name.toLowerCase())
            );
            // If only one project is selected, just use it
            if (!project && selectedProjects.length === 1) {
              project = selectedProjects[0];
            }
            if (!project) {
              console.error("[WorkflowChat] Could not match project:", edit.project, "Available:", selectedProjects.map(p => p.pathWithNamespace));
              continue;
            }

            // Check for existing file change
            const existing = await prisma.fileChange.findUnique({
              where: {
                executionId_projectId_filePath: {
                  executionId,
                  projectId: project.id,
                  filePath: edit.filePath,
                },
              },
            });

            if (existing) {
              // Accumulate: apply new edit to existing modified content
              const newModified = applyEdit(existing.modifiedContent, edit.original, edit.modified);
              await prisma.fileChange.update({
                where: { id: existing.id },
                data: { modifiedContent: newModified, status: "PENDING" },
              });
            } else {
              // Resolve original content from indexed files
              const indexed = await prisma.indexedFile.findFirst({
                where: { projectId: project.id, filePath: edit.filePath },
              });
              const originalContent = indexed?.content || "";
              const modifiedContent = applyEdit(originalContent, edit.original, edit.modified);

              await prisma.fileChange.create({
                data: {
                  executionId,
                  projectId: project.id,
                  filePath: edit.filePath,
                  originalContent,
                  modifiedContent,
                  language: getLanguageFromPath(edit.filePath),
                },
              });
            }
          } catch (err) {
            console.error("[WorkflowChat] Failed to process edit:", edit.filePath, err);
          }
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
