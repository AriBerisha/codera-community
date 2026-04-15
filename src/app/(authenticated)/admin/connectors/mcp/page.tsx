"use client";

import { useState, useEffect, useCallback } from "react";
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

interface McpServer {
  id: string;
  name: string;
  url: string;
  apiKey: string | null;
  enabled: boolean;
  createdAt: string;
}

interface TestResult {
  success: boolean;
  server?: { name: string; version: string };
  capabilities?: { tools: boolean; resources: boolean; prompts: boolean };
  tools?: Array<{ name: string; description?: string }>;
  resources?: Array<{ uri: string; name: string; description?: string }>;
  error?: string;
}

export default function McpPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [adding, setAdding] = useState(false);

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editApiKey, setEditApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  // Test
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/mcp/servers");
      if (res.ok) setServers(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch("/api/admin/mcp/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          url,
          apiKey: apiKey || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to add server");
        return;
      }
      toast.success("MCP server added");
      setName("");
      setUrl("");
      setApiKey("");
      fetchServers();
    } catch {
      toast.error("Failed to add server");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    await fetch(`/api/admin/mcp/servers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    fetchServers();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this MCP server?")) return;
    await fetch(`/api/admin/mcp/servers/${id}`, { method: "DELETE" });
    toast.success("Server removed");
    fetchServers();
  }

  function startEdit(server: McpServer) {
    setEditingId(server.id);
    setEditName(server.name);
    setEditUrl(server.url);
    setEditApiKey("");
    setTestResult(null);
  }

  async function handleSave(id: string) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editName,
        url: editUrl,
      };
      // Only send apiKey if the user typed something new
      if (editApiKey) {
        body.apiKey = editApiKey;
      }
      const res = await fetch(`/api/admin/mcp/servers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
        return;
      }
      toast.success("Server updated");
      setEditingId(null);
      fetchServers();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(server: McpServer) {
    setTesting(server.id);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/mcp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: server.url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({ success: false, error: data.error });
      } else {
        setTestResult(data);
      }
    } catch {
      setTestResult({ success: false, error: "Connection failed" });
    } finally {
      setTesting(null);
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
          Custom MCP Servers
        </h1>
        <p className="text-muted-foreground mt-1">
          Connect external MCP (Model Context Protocol) servers to provide
          additional tools and data sources to the AI.
        </p>
      </div>

      {/* Add Server Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add MCP Server</CardTitle>
          <CardDescription>
            Enter the server endpoint URL. The server must support Streamable
            HTTP or SSE transport.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mcp-name">Name</Label>
                <Input
                  id="mcp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My MCP Server"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mcp-url">Endpoint URL</Label>
                <Input
                  id="mcp-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://mcp.example.com/sse"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mcp-key">
                API Key{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="mcp-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Bearer token for authentication"
              />
            </div>
            <Button type="submit" disabled={adding}>
              {adding ? "Adding..." : "Add Server"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Server List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading servers...</p>
      ) : servers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No MCP servers configured yet. Add one above to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
            Configured Servers
          </h2>
          {servers.map((server) => (
            <Card key={server.id}>
              <CardContent className="py-4">
                {editingId === server.id ? (
                  /* ---- Edit Mode ---- */
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Server name"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Endpoint URL</Label>
                        <Input
                          type="url"
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        API Key{" "}
                        <span className="text-muted-foreground font-normal">
                          {server.apiKey
                            ? "(leave blank to keep current)"
                            : "(optional)"}
                        </span>
                      </Label>
                      <Input
                        type="password"
                        value={editApiKey}
                        onChange={(e) => setEditApiKey(e.target.value)}
                        placeholder={
                          server.apiKey
                            ? "••••••••  (unchanged)"
                            : "Bearer token"
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(server.id)}
                        disabled={saving}
                      >
                        {saving ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ---- View Mode ---- */
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              server.enabled ? "bg-[#3fb950]" : "bg-[#7d8590]"
                            }`}
                          />
                          <h3 className="text-sm font-semibold text-foreground">
                            {server.name}
                          </h3>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                          {server.url}
                        </p>
                        {server.apiKey && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Auth: Bearer token configured
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTest(server)}
                          disabled={testing === server.id}
                        >
                          {testing === server.id ? "Testing..." : "Test"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(server)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleToggle(server.id, server.enabled)
                          }
                        >
                          {server.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(server.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    {/* Test Result */}
                    {testResult && testing === null && (
                      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-2">
                        {testResult.success ? (
                          <>
                            <div className="flex items-center gap-1.5 text-[#3fb950] font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#3fb950]" />
                              Connected to {testResult.server?.name}{" "}
                              v{testResult.server?.version}
                            </div>
                            {testResult.capabilities && (
                              <p className="text-muted-foreground">
                                Capabilities:{" "}
                                {[
                                  testResult.capabilities.tools && "Tools",
                                  testResult.capabilities.resources &&
                                    "Resources",
                                  testResult.capabilities.prompts && "Prompts",
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "None"}
                              </p>
                            )}
                            {testResult.tools &&
                              testResult.tools.length > 0 && (
                                <div>
                                  <p className="text-muted-foreground font-medium mb-1">
                                    Tools ({testResult.tools.length}):
                                  </p>
                                  {testResult.tools.map((t) => (
                                    <p
                                      key={t.name}
                                      className="text-muted-foreground ml-2"
                                    >
                                      <span className="text-foreground font-mono">
                                        {t.name}
                                      </span>
                                      {t.description && ` — ${t.description}`}
                                    </p>
                                  ))}
                                </div>
                              )}
                            {testResult.resources &&
                              testResult.resources.length > 0 && (
                                <div>
                                  <p className="text-muted-foreground font-medium mb-1">
                                    Resources ({testResult.resources.length}):
                                  </p>
                                  {testResult.resources.map((r) => (
                                    <p
                                      key={r.uri}
                                      className="text-muted-foreground ml-2"
                                    >
                                      <span className="text-foreground font-mono">
                                        {r.name}
                                      </span>
                                      {r.description && ` — ${r.description}`}
                                    </p>
                                  ))}
                                </div>
                              )}
                          </>
                        ) : (
                          <div className="text-red-400">
                            Connection failed: {testResult.error}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>About MCP</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Model Context Protocol (MCP) is an open standard for connecting
            AI applications to external data sources and tools. MCP servers
            expose <strong>resources</strong> (data the AI can read) and{" "}
            <strong>tools</strong> (actions the AI can reference). Once added,
            select <strong>MCP</strong> as a data source in automations or chat
            to include context from your connected servers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
