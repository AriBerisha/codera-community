import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { GithubClient } from "@/lib/github/client";

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const localOnly = searchParams.get("local") === "true";

  if (!localOnly) {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    });

    if (!settings?.githubUrl || !settings?.githubPat) {
      return NextResponse.json(
        { error: "GitHub is not configured" },
        { status: 400 }
      );
    }

    try {
      const client = new GithubClient(settings.githubUrl, decrypt(settings.githubPat));

      const repos = settings.githubOrgName
        ? await client.listOrgRepos(settings.githubOrgName)
        : await client.listUserRepos();

      // Sync repos to database
      for (const repo of repos) {
        await prisma.githubProject.upsert({
          where: { githubId: repo.id },
          update: {
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description,
            htmlUrl: repo.html_url,
            defaultBranch: repo.default_branch || "main",
          },
          create: {
            githubId: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description,
            htmlUrl: repo.html_url,
            defaultBranch: repo.default_branch || "main",
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch repositories";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const projects = await prisma.githubProject.findMany({
    orderBy: { fullName: "asc" },
    include: {
      _count: { select: { files: true } },
    },
  });

  // Normalize shape to match GitLab projects for the frontend
  const normalized = projects.map((p) => ({
    id: p.id,
    githubId: p.githubId,
    name: p.name,
    pathWithNamespace: p.fullName,
    description: p.description,
    webUrl: p.htmlUrl,
    defaultBranch: p.defaultBranch,
    lastIndexedAt: p.lastIndexedAt,
    indexStatus: p.indexStatus,
    included: p.included,
    _count: p._count,
    source: "github" as const,
  }));

  return NextResponse.json(normalized);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { projectId, included } = await req.json();

  const project = await prisma.githubProject.update({
    where: { id: projectId },
    data: { included },
  });

  return NextResponse.json(project);
}
