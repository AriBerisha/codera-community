import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { GithubClient } from "@/lib/github/client";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { githubUrl, pat, orgName } = await req.json();

  if (!githubUrl || !pat) {
    return NextResponse.json(
      { error: "GitHub URL and Personal Access Token are required" },
      { status: 400 }
    );
  }

  try {
    const client = new GithubClient(githubUrl, pat);

    // Validate credentials
    const user = await client.validateConnection();

    // Validate org access if provided
    let org = null;
    if (orgName) {
      org = await client.getOrg(orgName);
    }

    // Save settings
    await prisma.appSettings.upsert({
      where: { id: "default" },
      update: {
        githubUrl,
        githubPat: encrypt(pat),
        githubOrgName: orgName || null,
      },
      create: {
        id: "default",
        setupCompleted: true,
        githubUrl,
        githubPat: encrypt(pat),
        githubOrgName: orgName || null,
      },
    });

    return NextResponse.json({
      success: true,
      user: { login: user.login, name: user.name },
      org: org ? { id: org.id, login: org.login, name: org.name } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
