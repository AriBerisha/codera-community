"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

type Status = "disconnected" | "connecting" | "pairing" | "connected";

type StatusResponse = {
  status: Status;
  qr: string | null;
  linkedPhone: string | null;
  linkedName: string | null;
  lastError: string | null;
  autoReply: boolean;
  botPrompt: string;
  persistedConnected: boolean;
};

export default function WhatsAppPage() {
  const [status, setStatus] = useState<Status>("disconnected");
  const [qr, setQr] = useState<string | null>(null);
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const [linkedName, setLinkedName] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const [autoReply, setAutoReply] = useState(false);
  const [botPrompt, setBotPrompt] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const pollRef = useRef<number | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/admin/whatsapp/status");
      if (!res.ok) return;
      const data: StatusResponse = await res.json();
      setStatus(data.status);
      setQr(data.qr);
      setLinkedPhone(data.linkedPhone);
      setLinkedName(data.linkedName);
      setLastError(data.lastError);
      setAutoReply(data.autoReply);
      setBotPrompt(data.botPrompt || "");
    } catch {
      // ignore transient polling errors
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Poll while pairing or connecting so the QR refreshes.
  useEffect(() => {
    if (status === "pairing" || status === "connecting") {
      pollRef.current = window.setInterval(refresh, 1500);
    }
    return () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [status]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/admin/whatsapp/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to start session");
        return;
      }
      toast.info("Scan the QR code with WhatsApp → Linked devices");
      await refresh();
    } catch {
      toast.error("Failed to start session");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect WhatsApp? You'll need to scan the QR again to reconnect.")) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch("/api/admin/whatsapp/disconnect", { method: "POST" });
      if (!res.ok) {
        toast.error("Failed to disconnect");
        return;
      }
      toast.success("Disconnected");
      await refresh();
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/whatsapp/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoReply, botPrompt }),
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

  const connected = status === "connected";
  const pairing = status === "pairing";

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      <div>
        <Link
          href="/admin/connectors"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Connectors
        </Link>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp Integration</h1>
        <p className="text-muted-foreground mt-1">
          Link your WhatsApp account by scanning a QR code — the same way you&apos;d add a
          new device in the official app. Receive and send messages, auto-reply to DMs, and
          use WhatsApp chats in automations.
        </p>
        <p className="text-[12px] text-amber-500 mt-2">
          Note: this uses an unofficial WhatsApp Web session. Use a phone number you&apos;re
          comfortable linking. High message volume can lead to temporary bans from WhatsApp.
        </p>
      </div>

      {/* Connection */}
      <Card>
        <CardHeader>
          <CardTitle>Pair Device</CardTitle>
          <CardDescription>
            On your phone, open WhatsApp → Settings → Linked devices → Link a device, then
            scan the QR code below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!connected && !pairing && (
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? "Starting..." : "Start Pairing"}
            </Button>
          )}

          {pairing && qr && (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-lg border border-border bg-white p-3">
                <Image
                  src={qr}
                  alt="WhatsApp pairing QR code"
                  width={256}
                  height={256}
                  unoptimized
                />
              </div>
              <p className="text-[13px] text-muted-foreground">
                Waiting for scan… the code refreshes automatically.
              </p>
              <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                Cancel
              </Button>
            </div>
          )}

          {pairing && !qr && (
            <p className="text-[13px] text-muted-foreground">Generating QR code…</p>
          )}

          {status === "connecting" && (
            <p className="text-[13px] text-muted-foreground">Connecting…</p>
          )}

          {lastError && !connected && (
            <p className="text-[12px] text-destructive mt-3">{lastError}</p>
          )}
        </CardContent>
      </Card>

      {/* Connected account */}
      {connected && (
        <Card>
          <CardHeader>
            <CardTitle>Linked Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]/15 text-[#25D366]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.861 9.861 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {linkedName || "WhatsApp Account"}
                </p>
                {linkedPhone && (
                  <p className="text-xs text-muted-foreground">+{linkedPhone}</p>
                )}
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-emerald-500/15 text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected
              </span>
              <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </Button>
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
              When enabled, the AI will automatically reply to direct messages. Group chats
              are never auto-replied to.
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
                  Enable auto-reply for direct messages
                </Label>
              </div>

              {autoReply && (
                <div className="space-y-2">
                  <Label htmlFor="bot-prompt">Bot System Prompt (optional)</Label>
                  <textarea
                    id="bot-prompt"
                    value={botPrompt}
                    onChange={(e) => setBotPrompt(e.target.value)}
                    placeholder="You are a helpful assistant replying in a WhatsApp chat. Keep responses concise, friendly, and plain text."
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">
                    Customize the AI personality for auto-replies. Leave empty for the default.
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

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground leading-relaxed space-y-2">
            <li>
              <strong className="text-foreground">Pairing:</strong> WhatsApp requires you to
              link devices via QR scan. This session persists across restarts — you only
              need to re-scan if you log out from the phone.
            </li>
            <li>
              <strong className="text-foreground">Agents:</strong> View and reply to messages
              from the{" "}
              <Link href="/admin/agents" className="text-[#68c2ff] underline underline-offset-2">
                Agents
              </Link>{" "}
              page.
            </li>
            <li>
              <strong className="text-foreground">Auto-Reply:</strong> DM-only by design —
              group auto-replies would quickly be noisy or lead to bans.
            </li>
            <li>
              <strong className="text-foreground">Automations:</strong> Select{" "}
              <strong>WhatsApp</strong> as a data source to include recent messages in AI
              context, or send automation results to WhatsApp chats.
            </li>
            <li>
              <strong className="text-foreground">Single instance:</strong> Only one running
              app replica can hold the WhatsApp session at a time.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
