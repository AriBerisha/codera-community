import type { WASocket, proto } from "baileys";
import { prisma } from "@/lib/prisma";
import { generateText } from "ai";
import { getModelInstance } from "@/lib/ai/providers";

type MessagesUpsert = {
  messages: proto.IWebMessageInfo[];
  type: "notify" | "append";
};

function unwrap(message: proto.IMessage | null | undefined): proto.IMessage | null {
  if (!message) return null;
  // Disappearing messages and view-once wrap the real payload one or two
  // levels deep; unwrap until we hit a non-wrapper.
  let cur: proto.IMessage = message;
  for (let i = 0; i < 4; i++) {
    const next =
      cur.ephemeralMessage?.message ||
      cur.viewOnceMessage?.message ||
      cur.viewOnceMessageV2?.message ||
      cur.viewOnceMessageV2Extension?.message ||
      cur.documentWithCaptionMessage?.message ||
      cur.editedMessage?.message;
    if (!next) break;
    cur = next;
  }
  return cur;
}

function extractText(message: proto.IMessage | null | undefined): string {
  const m = unwrap(message);
  if (!m) return "";
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ""
  );
}

function chatTypeOf(jid: string): "private" | "group" {
  return jid.endsWith("@g.us") ? "group" : "private";
}

async function resolveChatTitle(
  socket: WASocket,
  jid: string
): Promise<string | null> {
  if (chatTypeOf(jid) === "group") {
    try {
      const meta = await socket.groupMetadata(jid);
      return meta?.subject ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function handleIncomingMessages(
  socket: WASocket,
  evt: MessagesUpsert
): Promise<void> {
  // "notify" = real-time push, "append" = backfill/sync from another device.
  // Accept both so we don't drop messages after a reconnect, and rely on
  // the messageId unique constraint + auto-reply dedupe to avoid duplicates.
  if (evt.type !== "notify" && evt.type !== "append") return;
  const allowAutoReply = evt.type === "notify";

  for (const m of evt.messages) {
    const key = m.key;
    if (!key) continue;
    const text = extractText(m.message);
    if (!text) continue;

    const jid = key.remoteJid;
    if (!jid) continue;

    const isBot = !!key.fromMe;
    const type = chatTypeOf(jid);
    const chatTitle = await resolveChatTitle(socket, jid);
    const fromNumber =
      type === "group"
        ? (key.participant || m.participant || "")
            .split("@")[0]
            ?.split(":")[0] || null
        : jid.split("@")[0].split(":")[0] || null;
    const fromName = isBot
      ? "Bot"
      : m.pushName || fromNumber || "Unknown";

    const messageId = key.id ?? null;
    const timestamp = Number(m.messageTimestamp ?? 0);
    const sentAt = timestamp > 0 ? new Date(timestamp * 1000) : new Date();

    try {
      await prisma.whatsAppMessage.upsert({
        where: { messageId: messageId ?? `nomsg-${jid}-${sentAt.getTime()}` },
        update: {},
        create: {
          messageId,
          chatId: jid,
          chatTitle: chatTitle ?? (type === "private" ? fromName : null),
          chatType: type,
          fromName,
          fromNumber,
          text,
          isBot,
          sentAt,
        },
      });
    } catch (err) {
      console.error("[whatsapp] persist message failed", err);
      continue;
    }

    if (!isBot && allowAutoReply) {
      await maybeAutoReply(socket, jid, fromName, text).catch((err) =>
        console.error("[whatsapp] auto-reply failed", err)
      );
    }
  }
}

async function maybeAutoReply(
  socket: WASocket,
  jid: string,
  fromName: string,
  text: string
): Promise<void> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: { whatsappAutoReply: true, whatsappBotPrompt: true },
  });
  if (!settings?.whatsappAutoReply) return;

  // DM only — groups would be too spammy by default
  if (chatTypeOf(jid) !== "private") return;

  const recentReply = await prisma.whatsAppMessage.findFirst({
    where: {
      chatId: jid,
      isBot: true,
      sentAt: { gte: new Date(Date.now() - 60 * 1000) },
    },
  });
  if (recentReply) return;

  const systemPrompt =
    settings.whatsappBotPrompt ||
    "You are a helpful assistant replying in a WhatsApp chat. Keep responses concise, friendly, and plain text (no Markdown).";

  const model = await getModelInstance();
  const { text: reply } = await generateText({
    model,
    system: systemPrompt,
    prompt: `User "${fromName}" says: ${text}`,
    maxOutputTokens: 1024,
  });

  const res = await socket.sendMessage(jid, { text: reply });

  await prisma.whatsAppMessage.create({
    data: {
      messageId: res?.key?.id ?? null,
      chatId: jid,
      chatTitle: fromName,
      chatType: "private",
      fromName: "Bot",
      fromNumber: null,
      text: reply,
      isBot: true,
      sentAt: new Date(),
    },
  });
}
