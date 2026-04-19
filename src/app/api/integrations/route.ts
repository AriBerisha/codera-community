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
  if (settings?.telegramBotToken) {
    integrations.push({ value: "telegram", label: "Telegram" });
  }
  // Saved auth state is the durable signal — whatsappConnected can briefly
  // drift to false across restarts/HMR before the socket re-authenticates.
  if (settings?.whatsappAuthState) {
    integrations.push({ value: "whatsapp", label: "WhatsApp" });
  }
  if (settings?.resendApiKey && settings.resendFromEmail) {
    integrations.push({ value: "resend", label: "Resend" });
  }

  // Check for enabled MCP servers
  const mcpCount = await prisma.mcpServer.count({ where: { enabled: true } });
  if (mcpCount > 0) {
    integrations.push({ value: "mcp", label: "MCP" });
  }

  return NextResponse.json(integrations);
}
