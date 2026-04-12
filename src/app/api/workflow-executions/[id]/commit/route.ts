import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGitlabClient } from "@/lib/gitlab/get-client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { branch, commitMessage } = await req.json();

  if (!branch || !commitMessage) {
    return NextResponse.json({ error: "Branch and commit message are required" }, { status: 400 });
  }

  const execution = await prisma.workflowExecution.findUnique({
    where: { id, userId: session.user.id },
    include: {
      fileChanges: { where: { status: "ACCEPTED" } },
    },
  });

  if (!execution) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (execution.fileChanges.length === 0) {
    return NextResponse.json({ error: "No accepted file changes to commit" }, { status: 400 });
  }

  try {
    const client = await getGitlabClient();

    // Group changes by project
    const changesByProject = new Map<string, typeof execution.fileChanges>();
    for (const change of execution.fileChanges) {
      const existing = changesByProject.get(change.projectId) || [];
      existing.push(change);
      changesByProject.set(change.projectId, existing);
    }

    const results: Array<{ projectId: string; commitUrl: string }> = [];

    for (const [projectId, changes] of changesByProject) {
      const project = await prisma.gitlabProject.findUnique({ where: { id: projectId } });
      if (!project) continue;

      // Create branch (ignore error if already exists)
      try {
        await client.createBranch(project.gitlabId, branch, project.defaultBranch);
      } catch {
        // Branch may already exist from a previous attempt
      }

      // Build commit actions
      const actions = changes.map((c) => ({
        action: (c.originalContent.trim() ? "update" : "create") as "update" | "create",
        file_path: c.filePath,
        content: c.modifiedContent,
      }));

      const result = await client.createCommit(project.gitlabId, {
        branch,
        commit_message: commitMessage,
        actions,
      });

      results.push({ projectId, commitUrl: result.web_url });

      // Mark changes as committed
      await prisma.fileChange.updateMany({
        where: { executionId: id, projectId },
        data: { status: "COMMITTED" },
      });
    }

    // Update execution
    await prisma.workflowExecution.update({
      where: { id },
      data: {
        status: "COMPLETED",
        commitBranch: branch,
        commitMessage,
        commitResult: results,
      },
    });

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("[Commit] Error:", error);
    const message = error instanceof Error ? error.message : "Commit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
