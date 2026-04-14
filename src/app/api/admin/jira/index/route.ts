import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { JiraClient } from "@/lib/jira/client";
import { indexJiraProject } from "@/lib/jira/indexer";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { projectId } = await req.json();

  if (!projectId) {
    return NextResponse.json(
      { error: "Project ID is required" },
      { status: 400 }
    );
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.jiraUrl || !settings?.jiraEmail || !settings?.jiraApiToken) {
    return NextResponse.json(
      { error: "Jira is not configured" },
      { status: 400 }
    );
  }

  // Mark as indexing immediately
  await prisma.jiraProject.update({
    where: { id: projectId },
    data: { indexStatus: "INDEXING" },
  });

  const jiraUrl = settings.jiraUrl;
  const jiraEmail = settings.jiraEmail;
  const jiraApiToken = decrypt(settings.jiraApiToken);

  after(async () => {
    try {
      const client = new JiraClient(jiraUrl, jiraEmail, jiraApiToken);
      await indexJiraProject(projectId, client);
    } catch (error) {
      console.error("Jira indexing failed:", error);
      await prisma.jiraProject.update({
        where: { id: projectId },
        data: { indexStatus: "FAILED" },
      });
    }
  });

  return NextResponse.json({ success: true, message: "Indexing started" });
}
