"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export default function TelegramPage() {
  const [botToken, setBotToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [botInfo, setBotInfo] = useState<{
    name: string;
    username?: string;
  } | null>(null);
  const [webhookSet, setWebhookSet] = useState(false);

  // Auto-reply settings
  const [autoReply, setAutoReply] = useState(false);
  const [botPrompt, setBotPrompt] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Test message
  const [chatId, setChatId] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Load existing settings
  useEffect(() => {
    fetch("/api/admin/telegram/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setConnected(data.connected);
          setAutoReply(data.autoReply);
          setBotPrompt(data.botPrompt || "");
          setWebhookSet(data.webhookConfigured);
        }
      })
      .catch(() => {});

    // Also check if bot is connected by loading agents
    fetch("/api/admin/agents/telegram")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.connected && data.bot) {
          setConnected(true);
          setBotInfo(data.bot);
        }
      })
      .catch(() => {});
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    try {
      const res = await fetch("/api/admin/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Connection failed");
        return;
      }
      toast.success(`Connected to @${data.bot.username}`);
      setBotInfo({ name: data.bot.name, username: data.bot.username });
      setConnected(true);
      setWebhookSet(data.webhookSet);
      if (data.webhookSet) {
        toast.success("Webhook configured — messages will arrive in real-time");
      } else {
        toast.info("Running in polling mode — use Refresh in Agents to sync messages");
      }
    } catch {
      toast.error("Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/telegram/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoReply,
          botPrompt,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to save settings");
        return;
      }
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleTestMessage(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/admin/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          message: testMessage || "Test message from Codera",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to send");
        return;
      }
      toast.success("Test message sent!");
    } catch {
      toast.error("Failed to send test message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      <div>
        <Link
          href="/admin/connectors"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          Connectors
        </Link>
        <h1 className="text-2xl font-bold text-foreground">
          Telegram Integration
        </h1>
        <p className="text-muted-foreground mt-1">
          Connect a Telegram bot to receive and send messages, auto-reply when
          tagged, and use in automations. Create a bot via{" "}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#68c2ff] underline underline-offset-2"
          >
            @BotFather
          </a>{" "}
          and paste the token below.
        </p>
      </div>

      {/* Connection */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Settings</CardTitle>
          <CardDescription>
            Enter your Telegram bot token to connect.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bot-token">Bot Token</Label>
              <Input
                id="bot-token"
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                required
              />
            </div>
            <Button type="submit" disabled={connecting}>
              {connecting ? "Connecting..." : connected ? "Reconnect" : "Connect"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Connected bot info */}
      {connected && botInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Connected Bot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2AABEE]/15 text-[#2AABEE]">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {botInfo.name}
                </p>
                {botInfo.username && (
                  <p className="text-xs text-muted-foreground">
                    @{botInfo.username}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    webhookSet
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-amber-500/15 text-amber-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      webhookSet ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {webhookSet ? "Webhook (real-time)" : "Polling mode"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-reply settings */}
      {connected && (
        <Card>
          <CardHeader>
            <CardTitle>Auto-Reply Settings</CardTitle>
            <CardDescription>
              When enabled, the bot will automatically reply using AI when
              someone sends a direct message or @mentions the bot in a group.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoReply}
                  onClick={() => setAutoReply(!autoReply)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    autoReply ? "bg-[#68c2ff]" : "bg-muted"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
                      autoReply ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <Label className="cursor-pointer" onClick={() => setAutoReply(!autoReply)}>
                  Enable auto-reply
                </Label>
              </div>

              {autoReply && (
                <div className="space-y-2">
                  <Label htmlFor="bot-prompt">
                    Bot System Prompt (optional)
                  </Label>
                  <textarea
                    id="bot-prompt"
                    value={botPrompt}
                    onChange={(e) => setBotPrompt(e.target.value)}
                    placeholder="You are a helpful assistant in a Telegram chat. Keep responses concise and friendly."
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">
                    Customize the AI personality for auto-replies. Leave empty
                    for the default friendly assistant.
                  </p>
                </div>
              )}

              <Button type="submit" disabled={savingSettings}>
                {savingSettings ? "Saving..." : "Save Settings"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Test message */}
      {connected && (
        <Card>
          <CardHeader>
            <CardTitle>Send Test Message</CardTitle>
            <CardDescription>
              Send a test message to verify the bot can reach your chat. You can
              find the chat ID by adding{" "}
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#68c2ff] underline underline-offset-2"
              >
                @userinfobot
              </a>{" "}
              to your group or messaging it directly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTestMessage} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="chat-id">Chat ID</Label>
                  <Input
                    id="chat-id"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="-1001234567890"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test-msg">Message (optional)</Label>
                  <Input
                    id="test-msg"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Test message from Codera"
                  />
                </div>
              </div>
              <Button type="submit" disabled={sending}>
                {sending ? "Sending..." : "Send Test Message"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground leading-relaxed space-y-2">
            <li>
              <strong className="text-foreground">Agents:</strong> View and
              reply to messages from the{" "}
              <Link
                href="/admin/agents"
                className="text-[#68c2ff] underline underline-offset-2"
              >
                Agents
              </Link>{" "}
              page. Send messages directly to any chat.
            </li>
            <li>
              <strong className="text-foreground">Auto-Reply:</strong> When
              enabled, the bot uses AI to automatically respond to DMs and
              @mentions in group chats.
            </li>
            <li>
              <strong className="text-foreground">Automations:</strong> Select{" "}
              <strong>Telegram</strong> as a data source in automations to
              include recent bot messages. You can also send automation results
              to Telegram chats.
            </li>
            <li>
              <strong className="text-foreground">Group Privacy:</strong> By
              default, bots only receive @mentions and commands in groups. To
              receive all messages, disable privacy mode via{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#68c2ff] underline underline-offset-2"
              >
                @BotFather
              </a>{" "}
              → <code className="bg-muted px-1 rounded">/setprivacy</code> →
              Disable.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
