import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getModelInstance(): Promise<any> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings) throw new Error("App settings not configured");

  const apiKey = settings.aiApiKey ? decrypt(settings.aiApiKey) : undefined;

  switch (settings.aiProvider) {
    case "openrouter": {
      if (!apiKey) throw new Error("OpenRouter API key is required");
      const openrouter = createOpenRouter({ apiKey });
      return openrouter.chat(settings.aiModel);
    }
    case "openai": {
      if (!apiKey) throw new Error("OpenAI API key is required");
      const openai = createOpenAI({ apiKey });
      return openai.chat(settings.aiModel);
    }
    case "google": {
      if (!apiKey) throw new Error("Google AI API key is required");
      const google = createGoogleGenerativeAI({ apiKey });
      return google(settings.aiModel);
    }
    case "ollama": {
      // Use Ollama's OpenAI-compatible endpoint (/v1/chat/completions)
      // The native ollama-ai-provider uses spec v1 which is incompatible with AI SDK v6
      const rawUrl = settings.aiBaseUrl || "http://localhost:11434";
      const baseURL = rawUrl.replace(/\/+$/, "").replace(/\/api$/, "");
      const ollama = createOpenAI({
        apiKey: "ollama",
        baseURL: `${baseURL}/v1`,
      });
      return ollama.chat(settings.aiModel);
    }
    case "openwebui": {
      const rawUrl = settings.aiBaseUrl || "http://localhost:3000";
      const baseURL = rawUrl.replace(/\/+$/, "");
      const openwebui = createOpenAI({
        apiKey: apiKey || "not-needed",
        baseURL: `${baseURL}/api/v1`,
      });
      return openwebui.chat(settings.aiModel);
    }
    default:
      throw new Error(`Unknown AI provider: ${settings.aiProvider}`);
  }
}
