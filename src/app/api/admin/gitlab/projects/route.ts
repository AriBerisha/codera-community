import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { GitlabClient } from "@/lib/gitlab/client";

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const localOnly = searchParams.get("local") === "true";

  // If local-only (used during polling), skip the GitLab API sync
  if (!localOnly) {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    });

    if (!settings?.gitlabUrl || !settings?.gitlabPat || !settings?.gitlabGroupId) {
      return NextResponse.json(
        { error: "GitLab is not configured" },
        { status: 400 }
      );
    }

    try {
      const client = new GitlabClient(settings.gitlabUrl, decrypt(settings.gitlabPat));
      const gitlabProjects = await client.listGroupProjects(settings.gitlabGroupId);

      // Sync projects to database
      for (const gp of gitlabProjects) {
        await prisma.gitlabProject.upsert({
          where: { gitlabId: gp.id },
          update: {
            name: gp.name,
            pathWithNamespace: gp.path_with_namespace,
            description: gp.description,
            webUrl: gp.web_url,
            defaultBranch: gp.default_branch || "main",
          },
          create: {
            gitlabId: gp.id,
            name: gp.name,
            pathWithNamespace: gp.path_with_namespace,
            description: gp.description,
            webUrl: gp.web_url,
            defaultBranch: gp.default_branch || "main",
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch projects";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Return all projects with their local state
  const projects = await prisma.gitlabProject.findMany({
    orderBy: { pathWithNamespace: "asc" },
    include: {
      _count: { select: { files: true } },
    },
  });

  return NextResponse.json(projects.map(p => ({ ...p, source: "gitlab" })));
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { projectId, included } = await req.json();

  const project = await prisma.gitlabProject.update({
    where: { id: projectId },
    data: { included },
  });

  return NextResponse.json(project);
}
