import { prisma } from "@/lib/prisma";

const MAX_MESSAGES = 20;
const MAX_TEXT_LENGTH = 500;

/**
 * Build AI context from recent WhatsApp messages.
 * Messages are synced live by the Baileys session, so we only read here.
 */
export async function buildWhatsAppContext(userMessage: string): Promise<string> {
  void userMessage;

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: { whatsappConnected: true },
  });

  if (!settings?.whatsappConnected) return "";

  const messages = await prisma.whatsAppMessage.findMany({
    orderBy: { sentAt: "desc" },
    take: MAX_MESSAGES,
  });

  if (messages.length === 0) return "";

  let context = "\n\nHere are recent WhatsApp messages received by the linked account:\n\n";

  for (const msg of messages.reverse()) {
    const chatName = msg.chatTitle || msg.chatId.split("@")[0];
    const text =
      msg.text.length > MAX_TEXT_LENGTH
        ? msg.text.substring(0, MAX_TEXT_LENGTH) + "..."
        : msg.text;

    context += `--- WhatsApp: ${chatName} (${msg.chatType}) ---\n`;
    context += `From: ${msg.fromName}${msg.fromNumber ? ` (+${msg.fromNumber})` : ""}\n`;
    context += `Date: ${msg.sentAt.toISOString()}\n`;
    context += `${text}\n\n`;
  }

  return context;
}
