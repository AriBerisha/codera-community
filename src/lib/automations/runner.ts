import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import { getModelInstance } from "@/lib/ai/providers";
import { buildCodeContext } from "@/lib/ai/code-context";
import { buildJiraContext } from "@/lib/ai/jira-context";
import { buildConfluenceContext } from "@/lib/ai/confluence-context";
import { buildSharePointContext } from "@/lib/ai/sharepoint-context";
import { buildTelegramContext } from "@/lib/ai/telegram-context";
import { buildWhatsAppContext } from "@/lib/ai/whatsapp-context";
import { buildMcpContext } from "@/lib/ai/mcp-context";
import { ResendClient } from "@/lib/resend/client";
import { TelegramClient } from "@/lib/telegram/client";
import { sendWhatsAppMessage, isConnected as whatsappConnected } from "@/lib/whatsapp/session";
import { decrypt } from "@/lib/crypto";

/**
 * Parse a cron expression and check if it should have fired
 * between `lastRun` and `now`.
 *
 * Supports standard 5-field cron: minute hour day-of-month month day-of-week
 */
function cronMatchesBetween(
  cron: string,
  lastRun: Date | null,
  now: Date
): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minSpec, hourSpec, , , dowSpec] = parts;

  // For interval-based crons like "*/30 * * * *", compute from lastRun
  const intervalMatch = minSpec.match(/^\*\/(\d+)$/);
  if (intervalMatch && hourSpec === "*") {
    const intervalMin = parseInt(intervalMatch[1]);
    const lastTime = lastRun?.getTime() ?? 0;
    return now.getTime() - lastTime >= intervalMin * 60 * 1000;
  }

  // For hourly interval like "0 */4 * * *"
  const hourIntervalMatch = hourSpec.match(/^\*\/(\d+)$/);
  if (hourIntervalMatch && minSpec.match(/^\d+$/)) {
    const intervalHours = parseInt(hourIntervalMatch[1]);
    const lastTime = lastRun?.getTime() ?? 0;
    return now.getTime() - lastTime >= intervalHours * 60 * 60 * 1000;
  }

  // For fixed-time crons like "30 9 * * *" or "0 9 * * 1,3,5"
  // Check if the current minute matches the cron spec
  const nowMin = now.getMinutes();
  const nowHour = now.getHours();
  const nowDow = now.getDay(); // 0 = Sunday

  if (!fieldMatches(minSpec, nowMin)) return false;
  if (!fieldMatches(hourSpec, nowHour)) return false;
  if (!fieldMatches(dowSpec, nowDow)) return false;

  // Only fire if we haven't run in the last 59 seconds of this matching minute
  const lastTime = lastRun?.getTime() ?? 0;
  const minuteStart = new Date(now);
  minuteStart.setSeconds(0, 0);
  return lastTime < minuteStart.getTime();
}

function fieldMatches(spec: string, value: number): boolean {
  if (spec === "*") return true;

  // Handle step: */n
  const stepMatch = spec.match(/^\*\/(\d+)$/);
  if (stepMatch) return value % parseInt(stepMatch[1]) === 0;

  // Handle list: 1,3,5
  const parts = spec.split(",");
  for (const part of parts) {
    // Handle range: 1-5
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1]);
      const hi = parseInt(rangeMatch[2]);
      if (value >= lo && value <= hi) return true;
      continue;
    }
    if (parseInt(part) === value) return true;
  }
  return false;
}

export async function executeAutomation(automationId: string): Promise<void> {
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
  });

  if (!automation) throw new Error(`Automation not found: ${automationId}`);

  const run = await prisma.automationRun.create({
    data: {
      automationId,
      status: "RUNNING",
    },
  });

  try {
    // Build context from selected data sources
    const sources = automation.dataSources;
    const contextParts: Promise<string>[] = [];

    if (sources.includes("gitlab") || sources.includes("github")) {
      // Gather all included project IDs for code context
      const [glProjects, ghProjects] = await Promise.all([
        sources.includes("gitlab")
          ? prisma.gitlabProject.findMany({
              where: { included: true, indexStatus: "INDEXED" },
              select: { id: true },
            })
          : Promise.resolve([]),
        sources.includes("github")
          ? prisma.githubProject.findMany({
              where: { included: true, indexStatus: "INDEXED" },
              select: { id: true },
            })
          : Promise.resolve([]),
      ]);
      const projectIds = [...glProjects, ...ghProjects].map((p) => p.id);
      if (projectIds.length > 0) {
        contextParts.push(buildCodeContext(automation.instructions, projectIds));
      }
    }
    if (sources.includes("jira")) {
      contextParts.push(buildJiraContext(automation.instructions));
    }
    if (sources.includes("confluence")) {
      contextParts.push(buildConfluenceContext(automation.instructions));
    }
    if (sources.includes("sharepoint")) {
      contextParts.push(buildSharePointContext(automation.instructions));
    }
    if (sources.includes("telegram")) {
      contextParts.push(buildTelegramContext(automation.instructions));
    }
    if (sources.includes("whatsapp")) {
      contextParts.push(buildWhatsAppContext(automation.instructions));
    }
    if (sources.includes("mcp")) {
      contextParts.push(buildMcpContext(automation.instructions));
    }

    const contextResults = await Promise.all(contextParts);
    const context = contextResults.join("");

    const systemPrompt =
      "You are an AI assistant running a scheduled automation. " +
      "Follow the instructions precisely and provide a clear, concise response. " +
      "If the task involves analysis or reporting, structure your response with clear headings." +
      (context
        ? "\n\nHere is relevant context from the connected integrations:\n" +
          context
        : "");

    const model = await getModelInstance();

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: automation.instructions,
      maxOutputTokens: 4096,
    });

    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        response: text,
        completedAt: new Date(),
      },
    });

    await prisma.automation.update({
      where: { id: automationId },
      data: { lastRunAt: new Date() },
    });

    // Send outputs to configured channels
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    });

    // Send email if Resend is selected and recipients are configured
    if (
      sources.includes("resend") &&
      automation.emailRecipients.length > 0
    ) {
      try {
        if (settings?.resendApiKey && settings.resendFromEmail) {
          const resend = new ResendClient(decrypt(settings.resendApiKey));
          await resend.sendEmail({
            from: settings.resendFromEmail,
            to: automation.emailRecipients,
            subject: `[Automation] ${automation.title}`,
            text: text,
          });
        }
      } catch (emailErr) {
        console.error(`Failed to send automation email for ${automationId}:`, emailErr);
      }
    }

    // Send to Telegram chats if configured
    if (automation.telegramChatIds.length > 0 && settings?.telegramBotToken) {
      try {
        const tgClient = new TelegramClient(decrypt(settings.telegramBotToken));
        for (const chatId of automation.telegramChatIds) {
          try {
            await tgClient.sendMessage(chatId, text);
            // Store in DB
            await prisma.telegramMessage.create({
              data: {
                chatId: BigInt(chatId),
                chatType: "unknown",
                fromName: "Bot",
                text: `[${automation.title}]\n\n${text}`,
                isBot: true,
                sentAt: new Date(),
              },
            });
          } catch (chatErr) {
            console.error(`Failed to send to Telegram chat ${chatId}:`, chatErr);
          }
        }
      } catch (tgErr) {
        console.error(`Failed to send automation Telegram for ${automationId}:`, tgErr);
      }
    }

    // Send to WhatsApp chats if configured
    if (automation.whatsappChatIds.length > 0 && whatsappConnected()) {
      const body = `[${automation.title}]\n\n${text}`;
      for (const chatId of automation.whatsappChatIds) {
        try {
          const { messageId } = await sendWhatsAppMessage(chatId, body);
          const existing = await prisma.whatsAppMessage.findFirst({
            where: { chatId, chatTitle: { not: null } },
            select: { chatTitle: true, chatType: true },
          });
          await prisma.whatsAppMessage.create({
            data: {
              messageId,
              chatId,
              chatTitle: existing?.chatTitle ?? null,
              chatType: existing?.chatType ?? (chatId.endsWith("@g.us") ? "group" : "private"),
              fromName: "Bot",
              fromNumber: null,
              text: body,
              isBot: true,
              sentAt: new Date(),
            },
          });
        } catch (waErr) {
          console.error(`Failed to send to WhatsApp chat ${chatId}:`, waErr);
        }
      }
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";

    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        error: errorMessage,
        completedAt: new Date(),
      },
    });

    await prisma.automation.update({
      where: { id: automationId },
      data: { lastRunAt: new Date() },
    });
  }
}

/** Find and run all automations that are due based on their cron expression. */
export async function runDueAutomations(): Promise<{
  triggered: number;
  ids: string[];
}> {
  const automations = await prisma.automation.findMany({
    where: { enabled: true },
  });

  const now = new Date();
  const due: string[] = [];

  for (const auto of automations) {
    if (cronMatchesBetween(auto.cronExpression, auto.lastRunAt, now)) {
      due.push(auto.id);
    }
  }

  // Fire all due automations concurrently (don't await — fire-and-forget)
  for (const id of due) {
    executeAutomation(id).catch((err) =>
      console.error(`Automation ${id} failed:`, err)
    );
  }

  return { triggered: due.length, ids: due };
}
