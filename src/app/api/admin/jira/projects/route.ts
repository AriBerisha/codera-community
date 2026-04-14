import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { JiraClient } from "@/lib/jira/client";

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

    if (!settings?.jiraUrl || !settings?.jiraEmail || !settings?.jiraApiToken) {
      return NextResponse.json(
        { error: "Jira is not configured" },
        { status: 400 }
      );
    }

    try {
      const client = new JiraClient(
        settings.jiraUrl,
        settings.jiraEmail,
        decrypt(settings.jiraApiToken)
      );
      const jiraProjects = await client.listProjects();

      for (const jp of jiraProjects) {
        await prisma.jiraProject.upsert({
          where: { jiraId: jp.id },
          update: {
            key: jp.key,
            name: jp.name,
            description: jp.description || null,
            webUrl: client.projectUrl(jp.key),
          },
          create: {
            jiraId: jp.id,
            key: jp.key,
            name: jp.name,
            description: jp.description || null,
            webUrl: client.projectUrl(jp.key),
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch projects";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const projects = await prisma.jiraProject.findMany({
    orderBy: { key: "asc" },
    include: {
      _count: { select: { issues: true } },
    },
  });

  return NextResponse.json(
    projects.map((p) => ({ ...p, source: "jira" as const }))
  );
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { projectId, included } = await req.json();

  const project = await prisma.jiraProject.update({
    where: { id: projectId },
    data: { included },
  });

  return NextResponse.json(project);
}
