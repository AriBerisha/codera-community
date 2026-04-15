import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { isAdminRole } from "@/lib/auth-utils";

export async function GET() {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    return NextResponse.json({
      aiProvider: "openrouter",
      aiModel: "anthropic/claude-sonnet-4",
      hasApiKey: false,
      aiBaseUrl: "",
      gitlabConnected: false,
    });
  }

  return NextResponse.json({
    aiProvider: settings.aiProvider,
    aiModel: settings.aiModel,
    hasApiKey: !!settings.aiApiKey,
    aiBaseUrl: settings.aiBaseUrl || "",
    gitlabConnected: !!settings.gitlabUrl && !!settings.gitlabPat,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { aiProvider, aiModel, aiApiKey, aiBaseUrl } = await req.json();

    if (!aiProvider || !aiModel) {
      return NextResponse.json(
        { error: "Provider and model are required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, string | null> = {
      aiProvider,
      aiModel,
      aiBaseUrl: aiBaseUrl || null,
    };

    // Only update API key if a new one is provided
    if (aiApiKey) {
      updateData.aiApiKey = encrypt(aiApiKey);
    }

    await prisma.appSettings.upsert({
      where: { id: "default" },
      update: updateData,
      create: {
        id: "default",
        setupCompleted: true,
        ...updateData,
      },
    });

    console.log("[Settings] Saved: provider=%s model=%s baseUrl=%s", aiProvider, aiModel, aiBaseUrl || "(none)");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Settings] Save error:", error);
    const message = error instanceof Error ? error.message : "Failed to save";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

