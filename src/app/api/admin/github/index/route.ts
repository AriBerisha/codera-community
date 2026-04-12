import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { GithubClient } from "@/lib/github/client";
import { indexGithubProject } from "@/lib/github/indexer";

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

  if (!settings?.githubUrl || !settings?.githubPat) {
    return NextResponse.json(
      { error: "GitHub is not configured" },
      { status: 400 }
    );
  }

  // Mark as indexing immediately
  await prisma.githubProject.update({
    where: { id: projectId },
    data: { indexStatus: "INDEXING" },
  });

  const githubUrl = settings.githubUrl;
  const githubPat = decrypt(settings.githubPat);

  after(async () => {
    try {
      const client = new GithubClient(githubUrl, githubPat);
      await indexGithubProject(projectId, client);
    } catch (error) {
      console.error("GitHub indexing failed:", error);
      await prisma.githubProject.update({
        where: { id: projectId },
        data: { indexStatus: "FAILED" },
      });
    }
  });

  return NextResponse.json({ success: true, message: "Indexing started" });
}
