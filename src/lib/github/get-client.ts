import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { GithubClient } from "./client";

export async function getGithubClient(): Promise<GithubClient> {
  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  if (!settings?.githubUrl || !settings?.githubPat) {
    throw new Error("GitHub is not configured");
  }
  return new GithubClient(settings.githubUrl, decrypt(settings.githubPat));
}
