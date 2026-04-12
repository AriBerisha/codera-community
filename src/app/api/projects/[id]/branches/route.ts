import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGitlabClient } from "@/lib/gitlab/get-client";
import { getGithubClient } from "@/lib/github/get-client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  // Try GitLab project first
  const gitlabProject = await prisma.gitlabProject.findUnique({ where: { id } });
  if (gitlabProject) {
    try {
      const client = await getGitlabClient();
      let branches: Array<{ name: string }>;
      if (search) {
        branches = await client.searchBranches(gitlabProject.gitlabId, search);
      } else {
        branches = await client.listProtectedBranches(gitlabProject.gitlabId);
        if (!branches.some(b => b.name === gitlabProject.defaultBranch)) {
          branches.unshift({ name: gitlabProject.defaultBranch });
        }
      }
      return NextResponse.json(
        branches.map(b => ({ name: b.name, isDefault: b.name === gitlabProject.defaultBranch }))
      );
    } catch (error) {
      console.error("[Branches] GitLab error:", error);
      return NextResponse.json([{ name: gitlabProject.defaultBranch, isDefault: true }]);
    }
  }

  // Try GitHub project
  const githubProject = await prisma.githubProject.findUnique({ where: { id } });
  if (githubProject) {
    const [owner, repo] = githubProject.fullName.split("/");
    try {
      const client = await getGithubClient();
      let branches: Array<{ name: string }>;
      if (search) {
        branches = await client.searchBranches(owner, repo, search);
      } else {
        branches = await client.listProtectedBranches(owner, repo);
        if (!branches.some(b => b.name === githubProject.defaultBranch)) {
          branches.unshift({ name: githubProject.defaultBranch });
        }
      }
      return NextResponse.json(
        branches.map(b => ({ name: b.name, isDefault: b.name === githubProject.defaultBranch }))
      );
    } catch (error) {
      console.error("[Branches] GitHub error:", error);
      return NextResponse.json([{ name: githubProject.defaultBranch, isDefault: true }]);
    }
  }

  return NextResponse.json({ error: "Project not found" }, { status: 404 });
}
