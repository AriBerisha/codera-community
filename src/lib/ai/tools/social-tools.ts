import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { TelegramClient } from "@/lib/telegram/client";
import { sendWhatsAppMessage, isConnected as whatsappConnected } from "@/lib/whatsapp/session";

const MAX_RECENT_CHATS = 20;

type ChatOption = { id: string; title: string; type: string };

async function recentTelegramChats(): Promise<ChatOption[]> {
  const messages = await prisma.telegramMessage.findMany({
    distinct: ["chatId"],
    orderBy: { sentAt: "desc" },
    take: MAX_RECENT_CHATS,
    select: { chatId: true, chatTitle: true, chatType: true },
  });
  return messages.map((m) => ({
    id: m.chatId.toString(),
    title: m.chatTitle || `Chat ${m.chatId}`,
    type: m.chatType,
  }));
}

async function recentWhatsAppChats(): Promise<ChatOption[]> {
  const messages = await prisma.whatsAppMessage.findMany({
    distinct: ["chatId"],
    orderBy: { sentAt: "desc" },
    take: MAX_RECENT_CHATS,
    select: { chatId: true, chatTitle: true, chatType: true },
  });
  return messages.map((m) => ({
    id: m.chatId,
    title: m.chatTitle || m.chatId.split("@")[0],
    type: m.chatType,
  }));
}

/**
 * Build a short directory of known chats to append to the system prompt so
 * the model can map a user's "the team group" / "Alice" to a real chatId
 * instead of inventing one.
 */
export async function buildChatsDirectory(options: {
  telegram: boolean;
  whatsapp: boolean;
}): Promise<string> {
  const parts: string[] = [];

  if (options.telegram) {
    const chats = await recentTelegramChats().catch(() => []);
    if (chats.length > 0) {
      parts.push("\n\nTelegram chats available (use these exact ids):");
      for (const c of chats) {
        parts.push(`- ${c.id} — ${c.title} (${c.type})`);
      }
    }
  }

  if (options.whatsapp) {
    const chats = await recentWhatsAppChats().catch(() => []);
    if (chats.length > 0) {
      parts.push("\n\nWhatsApp chats available (use these exact ids):");
      for (const c of chats) {
        parts.push(`- ${c.id} — ${c.title} (${c.type})`);
      }
    }
  }

  if (parts.length === 0) return "";
  parts.push(
    "\nWhen the user asks to send a message to one of these, call the corresponding tool with the exact id. Do not invent ids."
  );
  return parts.join("\n");
}

export function buildSocialTools(options: {
  telegram: boolean;
  whatsapp: boolean;
}): ToolSet {
  const tools: ToolSet = {};

  if (options.telegram) {
    tools.sendTelegramMessage = tool({
      description:
        "Send a Telegram message from the connected bot to a specific chat. " +
        "Use only the chatId values listed in the system prompt's Telegram directory.",
      inputSchema: z.object({
        chatId: z
          .string()
          .describe("Telegram chat id (numeric string, e.g. '-1001234567890' for groups)"),
        message: z.string().describe("Plain-text message body to send"),
      }),
      execute: async ({ chatId, message }) => {
        const settings = await prisma.appSettings.findUnique({
          where: { id: "default" },
          select: { telegramBotToken: true },
        });
        if (!settings?.telegramBotToken) {
          return { success: false, error: "Telegram bot is not configured" };
        }
        try {
          const client = new TelegramClient(decrypt(settings.telegramBotToken));
          const result = await client.sendMessage(chatId, message);
          const messageId = (result as { message_id?: number } | null)?.message_id ?? null;
          await prisma.telegramMessage.create({
            data: {
              chatId: BigInt(chatId),
              chatType: "unknown",
              fromName: "Bot",
              text: message,
              isBot: true,
              sentAt: new Date(),
            },
          });
          return { success: true, messageId };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : "Failed to send",
          };
        }
      },
    });
  }

  if (options.whatsapp) {
    tools.sendWhatsAppMessage = tool({
      description:
        "Send a WhatsApp message from the linked account to a specific chat. " +
        "Use only the chatId values listed in the system prompt's WhatsApp directory.",
      inputSchema: z.object({
        chatId: z
          .string()
          .describe(
            "WhatsApp JID, e.g. '15551234567@s.whatsapp.net' for DMs or '<id>@g.us' for groups"
          ),
        message: z.string().describe("Plain-text message body to send"),
      }),
      execute: async ({ chatId, message }) => {
        if (!whatsappConnected()) {
          return { success: false, error: "WhatsApp is not connected" };
        }
        try {
          const { messageId } = await sendWhatsAppMessage(chatId, message);
          const existing = await prisma.whatsAppMessage.findFirst({
            where: { chatId, chatTitle: { not: null } },
            select: { chatTitle: true, chatType: true },
          });
          await prisma.whatsAppMessage.create({
            data: {
              messageId,
              chatId,
              chatTitle: existing?.chatTitle ?? null,
              chatType:
                existing?.chatType ??
                (chatId.endsWith("@g.us") ? "group" : "private"),
              fromName: "Bot",
              fromNumber: null,
              text: message,
              isBot: true,
              sentAt: new Date(),
            },
          });
          return { success: true, messageId };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : "Failed to send",
          };
        }
      },
    });
  }

  return tools;
}
