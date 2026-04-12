import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { GitlabClient } from "./client";

export async function getGitlabClient(): Promise<GitlabClient> {
  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  if (!settings?.gitlabUrl || !settings?.gitlabPat) {
    throw new Error("GitLab is not configured");
  }
  return new GitlabClient(settings.gitlabUrl, decrypt(settings.gitlabPat));
}
