"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const PROVIDER_OPTIONS = [
  { value: "openrouter", label: "OpenRouter (Claude, etc.)" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google AI" },
  { value: "ollama", label: "Ollama (Local)" },
  { value: "openwebui", label: "Open WebUI" },
];

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  openrouter: [
    "anthropic/claude-sonnet-4",
    "anthropic/claude-haiku-4",
    "openai/gpt-4o",
    "google/gemini-2.0-flash",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  google: ["gemini-2.0-flash", "gemini-2.0-pro"],
  ollama: ["llama3", "codellama", "mistral", "deepseek-coder"],
  openwebui: ["llama3", "codellama", "mistral", "deepseek-coder"],
};

const NEEDS_BASE_URL = new Set(["ollama", "openwebui"]);
const NEEDS_API_KEY = new Set(["openrouter", "openai", "google", "openwebui"]);

const BASE_URL_PLACEHOLDERS: Record<string, string> = {
  ollama: "http://localhost:11434",
  openwebui: "http://localhost:3000",
};

const BASE_URL_HELP: Record<string, string> = {
  ollama: "Ollama server URL (usually http://localhost:11434). Do not include /api.",
  openwebui: "Open WebUI instance URL (e.g. http://localhost:3000). The /api path is appended automatically.",
};

export default function AISettingsPage() {
  const [provider, setProvider] = useState("openrouter");
  const [model, setModel] = useState("anthropic/claude-sonnet-4");
  const [apiKey, setApiKey] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        setProvider(data.aiProvider || "openrouter");
        setModel(data.aiModel || "anthropic/claude-sonnet-4");
        setAiBaseUrl(data.aiBaseUrl || "");
        setHasApiKey(data.hasApiKey || false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiProvider: provider,
          aiModel: model,
          aiApiKey: apiKey || undefined,
          aiBaseUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save settings");
        return;
      }
      toast.success("AI settings saved");
      setHasApiKey(!!apiKey || hasApiKey);
      setApiKey("");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiProvider: provider,
          aiModel: model,
          aiApiKey: apiKey || undefined,
          aiBaseUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`Test failed: ${data.error}`);
        return;
      }
      toast.success(`AI responded: "${data.response}"`);
    } catch {
      toast.error("Test failed");
    } finally {
      setTesting(false);
    }
  }

  const showBaseUrl = NEEDS_BASE_URL.has(provider);
  const showApiKey = NEEDS_API_KEY.has(provider);

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure which AI model to use for the chat interface.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <CardDescription>
            Choose your AI provider and model. API keys are encrypted at rest.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={provider}
                onValueChange={(val) => {
                  if (val) {
                    setProvider(val);
                    setModel(MODEL_SUGGESTIONS[val]?.[0] || "");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                required
                placeholder="Model ID"
              />
              {MODEL_SUGGESTIONS[provider] && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {MODEL_SUGGESTIONS[provider].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModel(m)}
                      className="text-xs px-2 py-1 bg-muted rounded hover:bg-accent transition-colors"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {showApiKey && (
              <div>
                <Label htmlFor="api-key">
                  API Key{" "}
                  {hasApiKey && "(saved - leave blank to keep current)"}
                  {provider === "openwebui" && !hasApiKey && " (optional if auth is disabled)"}
                </Label>
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    hasApiKey
                      ? "Leave blank to keep current key"
                      : "Enter API key"
                  }
                />
              </div>
            )}

            {showBaseUrl && (
              <div>
                <Label htmlFor="base-url">Base URL</Label>
                <Input
                  id="base-url"
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                  placeholder={BASE_URL_PLACEHOLDERS[provider] || ""}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {BASE_URL_HELP[provider] || ""}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={testing}
                onClick={handleTest}
              >
                {testing ? "Testing..." : "Test Connection"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
