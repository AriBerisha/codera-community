import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { GitlabClient } from "@/lib/gitlab/client";
import { indexProject } from "@/lib/gitlab/indexer";

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

  if (!settings?.gitlabUrl || !settings?.gitlabPat) {
    return NextResponse.json(
      { error: "GitLab is not configured" },
      { status: 400 }
    );
  }

  // Mark as indexing immediately
  await prisma.gitlabProject.update({
    where: { id: projectId },
    data: { indexStatus: "INDEXING" },
  });

  // Run indexing in the background after response is sent
  const gitlabUrl = settings.gitlabUrl;
  const gitlabPat = decrypt(settings.gitlabPat);

  after(async () => {
    try {
      const client = new GitlabClient(gitlabUrl, gitlabPat);
      await indexProject(projectId, client);
    } catch (error) {
      console.error("Indexing failed:", error);
      await prisma.gitlabProject.update({
        where: { id: projectId },
        data: { indexStatus: "FAILED" },
      });
    }
  });

  return NextResponse.json({ success: true, message: "Indexing started" });
}
