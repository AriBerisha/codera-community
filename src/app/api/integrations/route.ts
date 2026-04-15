import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Returns which integrations are configured (have credentials saved). */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  const integrations: Array<{ value: string; label: string }> = [];

  if (settings?.gitlabUrl && settings.gitlabPat) {
    integrations.push({ value: "gitlab", label: "GitLab" });
  }
  if (settings?.githubPat) {
    integrations.push({ value: "github", label: "GitHub" });
  }
  if (settings?.jiraUrl && settings.jiraApiToken) {
    integrations.push({ value: "jira", label: "Jira" });
  }
  if (settings?.confluenceUrl && settings.confluenceApiToken) {
    integrations.push({ value: "confluence", label: "Confluence" });
  }
  if (settings?.sharepointTenantId && settings.sharepointClientSecret) {
    integrations.push({ value: "sharepoint", label: "SharePoint" });
  }

  return NextResponse.json(integrations);
}
