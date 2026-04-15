import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { GitlabClient } from "@/lib/gitlab/client";
import { isAdminRole } from "@/lib/auth-utils";

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { gitlabUrl, pat, groupId } = await req.json();

  if (!gitlabUrl || !pat || !groupId) {
    return NextResponse.json(
      { error: "GitLab URL, PAT, and Group ID are required" },
      { status: 400 }
    );
  }

  try {
    const client = new GitlabClient(gitlabUrl, pat);

    // Validate credentials
    await client.validateConnection();

    // Validate group access
    const group = await client.getGroup(groupId);

    // Save settings
    await prisma.appSettings.upsert({
      where: { id: "default" },
      update: {
        gitlabUrl,
        gitlabPat: encrypt(pat),
        gitlabGroupId: groupId,
      },
      create: {
        id: "default",
        setupCompleted: true,
        gitlabUrl,
        gitlabPat: encrypt(pat),
        gitlabGroupId: groupId,
      },
    });

    return NextResponse.json({
      success: true,
      group: { id: group.id, name: group.name, path: group.full_path },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
