import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGitlabClient } from "@/lib/gitlab/get-client";
import { getGithubClient } from "@/lib/github/get-client";

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

  // Get accepted or pending file changes for this conversation
  const fileChanges = await prisma.fileChange.findMany({
    where: {
      conversationId: id,
      conversation: { userId: session.user.id },
      status: { in: ["ACCEPTED", "PENDING"] },
    },
  });

  if (fileChanges.length === 0) {
    return NextResponse.json({ error: "No file changes to commit" }, { status: 400 });
  }

  try {
    // Group changes by project
    const changesByProject = new Map<string, typeof fileChanges>();
    for (const change of fileChanges) {
      const existing = changesByProject.get(change.projectId) || [];
      existing.push(change);
      changesByProject.set(change.projectId, existing);
    }

    const results: Array<{ projectId: string; commitUrl: string }> = [];

    for (const [projectId, changes] of changesByProject) {
      // Try GitLab project first
      const gitlabProject = await prisma.gitlabProject.findUnique({ where: { id: projectId } });
      if (gitlabProject) {
        const client = await getGitlabClient();

        try {
          await client.createBranch(gitlabProject.gitlabId, branch, gitlabProject.defaultBranch);
        } catch {
          // Branch may already exist
        }

        const actions = changes.map((c) => ({
          action: (c.originalContent.trim() ? "update" : "create") as "update" | "create",
          file_path: c.filePath,
          content: c.modifiedContent,
        }));

        const result = await client.createCommit(gitlabProject.gitlabId, {
          branch,
          commit_message: commitMessage,
          actions,
        });

        results.push({ projectId, commitUrl: result.web_url });
      } else {
        // Try GitHub project
        const githubProject = await prisma.githubProject.findUnique({ where: { id: projectId } });
        if (!githubProject) continue;

        const client = await getGithubClient();
        const [owner, repo] = githubProject.fullName.split("/");

        try {
          await client.createBranch(owner, repo, branch, githubProject.defaultBranch);
        } catch {
          // Branch may already exist
        }

        const files = changes.map((c) => ({
          path: c.filePath,
          content: c.modifiedContent,
        }));

        const result = await client.createCommit(owner, repo, branch, commitMessage, files);
        results.push({ projectId, commitUrl: result.html_url });
      }

      await prisma.fileChange.updateMany({
        where: { conversationId: id, projectId },
        data: { status: "COMMITTED" },
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("[Commit] Error:", error);
    const message = error instanceof Error ? error.message : "Commit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
