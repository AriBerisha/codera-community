"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { toast } from "sonner";

interface Agent {
  id: string;
  name: string;
  platform: string;
  connected: boolean;
}

interface TelegramMessage {
  id: string;
  from: string;
  username: string | null;
  text: string;
  date: string;
  isBot: boolean;
}

interface TelegramChat {
  id: string;
  title: string;
  type: string;
  messages: TelegramMessage[];
}

interface TelegramData {
  connected: boolean;
  bot?: { name: string; username?: string };
  chats: TelegramChat[];
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [telegramData, setTelegramData] = useState<TelegramData | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);

  // Send message state
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/agents")
      .then((r) => r.json())
      .then((data) => {
        setAgents(data);
        const first = data.find((a: Agent) => a.connected);
        if (first) {
          setSelectedAgent(first.id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const fetchTelegramMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const res = await fetch("/api/admin/agents/telegram");
      if (res.ok) {
        const data = await res.json();
        setTelegramData(data);
        if (data.chats?.length > 0 && !selectedChat) {
          setSelectedChat(data.chats[0].id);
        }
      }
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedChat]);

  useEffect(() => {
    if (selectedAgent === "telegram") {
      fetchTelegramMessages();
    }
  }, [selectedAgent, fetchTelegramMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedChat, telegramData]);

  const activeChat = telegramData?.chats.find((c) => c.id === selectedChat);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!messageText.trim() || !selectedChat) return;

    setSending(true);
    try {
      const res = await fetch("/api/admin/agents/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: selectedChat,
          message: messageText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to send");
        return;
      }
      setMessageText("");
      // Refresh to show the sent message
      fetchTelegramMessages();
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const hasConnectedAgent = agents.some((a) => a.connected);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agents</h1>
            <p className="text-muted-foreground mt-1">
              Read and send messages from your connected social bots.
            </p>
          </div>
          {selectedAgent === "telegram" && telegramData?.connected && (
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTelegramMessages}
              disabled={loadingMessages}
            >
              {loadingMessages ? "Refreshing..." : "Refresh"}
            </Button>
          )}
        </div>
      </div>

      {!hasConnectedAgent ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3 max-w-md">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                  />
                </svg>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              No social agents connected yet. Connect a bot in{" "}
              <Link
                href="/admin/connectors"
                className="text-[#68c2ff] underline underline-offset-2"
              >
                Connectors
              </Link>{" "}
              to see messages here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Left: Agent & Chat list */}
          <div className="w-64 border-r border-border flex flex-col min-h-0">
            {/* Agent tabs */}
            <div className="px-3 py-2 border-b border-border">
              <div className="flex gap-1">
                {agents
                  .filter((a) => a.connected)
                  .map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgent(agent.id);
                        setSelectedChat(null);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedAgent === agent.id
                          ? "bg-[#007acc]/15 text-[#68c2ff]"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {agent.platform === "telegram" && <TelegramSmallIcon />}
                      {agent.name}
                    </button>
                  ))}
              </div>
            </div>

            {/* Bot info */}
            {selectedAgent === "telegram" && telegramData?.bot && (
              <div className="px-3 py-2 border-b border-border">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Bot
                </p>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {telegramData.bot.name}
                </p>
                {telegramData.bot.username && (
                  <p className="text-xs text-muted-foreground">
                    @{telegramData.bot.username}
                  </p>
                )}
              </div>
            )}

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-3 py-2">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                  Chats
                </p>
              </div>
              {loadingMessages ? (
                <p className="px-3 text-xs text-muted-foreground">
                  Loading...
                </p>
              ) : telegramData?.chats.length === 0 ? (
                <p className="px-3 text-xs text-muted-foreground">
                  No messages yet. Send a message to your bot to see it here.
                </p>
              ) : (
                <div className="space-y-0.5 px-1.5">
                  {telegramData?.chats.map((chat) => {
                    const lastMsg =
                      chat.messages[chat.messages.length - 1];
                    return (
                      <button
                        key={chat.id}
                        onClick={() => setSelectedChat(chat.id)}
                        className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors ${
                          selectedChat === chat.id
                            ? "bg-[#007acc]/15"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p
                                className={`text-[13px] font-medium truncate ${
                                  selectedChat === chat.id
                                    ? "text-[#68c2ff]"
                                    : "text-foreground"
                                }`}
                              >
                                {chat.title}
                              </p>
                              <Badge
                                variant="secondary"
                                className="text-[9px] px-1 py-0 shrink-0"
                              >
                                {chat.type}
                              </Badge>
                            </div>
                            {lastMsg && (
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {lastMsg.isBot ? "Bot: " : ""}
                                {lastMsg.text}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {chat.messages.length}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Messages */}
          <div className="flex-1 flex flex-col min-h-0">
            {activeChat ? (
              <>
                {/* Chat header */}
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <TelegramSmallIcon />
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      {activeChat.title}
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      {activeChat.type} &middot; {activeChat.messages.length}{" "}
                      message{activeChat.messages.length !== 1 ? "s" : ""} &middot; ID: {activeChat.id}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {activeChat.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.isBot ? "flex-row-reverse" : ""}`}
                    >
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold shrink-0 mt-0.5 ${
                          msg.isBot
                            ? "bg-[#68c2ff]/15 text-[#68c2ff]"
                            : "bg-[#2AABEE]/15 text-[#2AABEE]"
                        }`}
                      >
                        {msg.isBot ? "B" : msg.from.charAt(0).toUpperCase()}
                      </div>
                      <div
                        className={`min-w-0 flex-1 ${msg.isBot ? "text-right" : ""}`}
                      >
                        <div
                          className={`flex items-baseline gap-2 ${
                            msg.isBot ? "justify-end" : ""
                          }`}
                        >
                          <span className="text-[13px] font-semibold text-foreground">
                            {msg.isBot ? "Bot" : msg.from}
                          </span>
                          {!msg.isBot && msg.username && (
                            <span className="text-[11px] text-muted-foreground">
                              @{msg.username}
                            </span>
                          )}
                          <span
                            className={`text-[10px] text-muted-foreground ${
                              msg.isBot ? "" : "ml-auto"
                            } shrink-0`}
                          >
                            {formatDate(msg.date)}
                          </span>
                        </div>
                        <div
                          className={`mt-1 inline-block rounded-xl px-3 py-2 max-w-[85%] ${
                            msg.isBot
                              ? "bg-[#007acc]/15 text-foreground"
                              : "bg-muted text-foreground/90"
                          }`}
                        >
                          <p className="text-[13px] whitespace-pre-wrap break-words text-left">
                            {msg.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Send message input */}
                <div className="border-t border-border px-4 py-3">
                  <form
                    onSubmit={handleSendMessage}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      disabled={sending}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={sending || !messageText.trim()}
                    >
                      {sending ? (
                        "Sending..."
                      ) : (
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                          />
                        </svg>
                      )}
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  {telegramData?.chats.length
                    ? "Select a chat to view messages"
                    : "No messages received yet"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TelegramSmallIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-[#2AABEE] shrink-0"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}
