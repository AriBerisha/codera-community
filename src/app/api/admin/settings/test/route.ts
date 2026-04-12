import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { aiProvider, aiModel, aiApiKey, aiBaseUrl } = await req.json();

  if (!aiProvider || !aiModel) {
    return NextResponse.json({ error: "Provider and model are required" }, { status: 400 });
  }

  // Resolve the API key: use the provided one, or fall back to the saved one
  let resolvedKey = aiApiKey;
  if (!resolvedKey) {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    });
    if (settings?.aiApiKey) {
      resolvedKey = decrypt(settings.aiApiKey);
    }
  }

  try {
    // Build model instance from the form values (not from DB)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let model: any;

    switch (aiProvider) {
      case "openrouter": {
        if (!resolvedKey) throw new Error("OpenRouter API key is required");
        const openrouter = createOpenRouter({ apiKey: resolvedKey });
        model = openrouter.chat(aiModel);
        break;
      }
      case "openai": {
        if (!resolvedKey) throw new Error("OpenAI API key is required");
        const openai = createOpenAI({ apiKey: resolvedKey });
        model = openai.chat(aiModel);
        break;
      }
      case "google": {
        if (!resolvedKey) throw new Error("Google AI API key is required");
        const google = createGoogleGenerativeAI({ apiKey: resolvedKey });
        model = google(aiModel);
        break;
      }
      case "ollama": {
        const rawUrl = aiBaseUrl || "http://localhost:11434";
        const baseURL = rawUrl.replace(/\/+$/, "").replace(/\/api$/, "");
        const ollama = createOpenAI({
          apiKey: "ollama",
          baseURL: `${baseURL}/v1`,
        });
        model = ollama.chat(aiModel);
        break;
      }
      case "openwebui": {
        const rawUrl = aiBaseUrl || "http://localhost:3000";
        const baseURL = rawUrl.replace(/\/+$/, "");
        const openwebui = createOpenAI({
          apiKey: resolvedKey || "not-needed",
          baseURL: `${baseURL}/api/v1`,
        });
        model = openwebui.chat(aiModel);
        break;
      }
      default:
        throw new Error(`Unknown AI provider: ${aiProvider}`);
    }

    const { text } = await generateText({
      model,
      prompt: "Say 'Connection successful!' in exactly those words.",
      maxOutputTokens: 20,
    });

    return NextResponse.json({ success: true, response: text });
  } catch (error) {
    console.error("[AI Test] Error:", error);
    const message = error instanceof Error ? error.message : "Test failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
