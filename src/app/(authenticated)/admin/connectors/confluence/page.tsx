"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface Space {
  id: string;
  confluenceId: string;
  key: string;
  name: string;
  description: string | null;
  webUrl: string;
  included: boolean;
  indexStatus: string;
  lastIndexedAt: string | null;
  _count: { pages: number };
}

export default function ConfluencePage() {
  const [confluenceUrl, setConfluenceUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [indexingSpace, setIndexingSpace] = useState<string | null>(null);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    try {
      const res = await fetch("/api/admin/confluence/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confluenceUrl, email, apiToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Connection failed");
        return;
      }
      toast.success(`Connected as ${data.user.displayName}`);
      setConnected(true);
      fetchSpaces();
    } catch {
      toast.error("Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function fetchSpaces() {
    setLoadingSpaces(true);
    try {
      const res = await fetch("/api/admin/confluence/spaces");
      if (res.ok) {
        const data = await res.json();
        setSpaces(data);
        setConnected(true);
      }
    } catch {
      // Confluence not configured yet
    } finally {
      setLoadingSpaces(false);
    }
  }

  async function toggleInclude(spaceId: string, included: boolean) {
    try {
      await fetch("/api/admin/confluence/spaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaceId, included }),
      });
      setSpaces((prev) =>
        prev.map((s) => (s.id === spaceId ? { ...s, included } : s))
      );
    } catch {
      toast.error("Failed to update space");
    }
  }

  async function handleIndex(spaceId: string) {
    setIndexingSpace(spaceId);
    setSpaces((prev) =>
      prev.map((s) =>
        s.id === spaceId ? { ...s, indexStatus: "INDEXING" } : s
      )
    );

    try {
      const res = await fetch("/api/admin/confluence/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Indexing failed");
        setIndexingSpace(null);
        return;
      }
      toast.success("Indexing started in background...");
      startPolling();
    } catch {
      toast.error("Indexing failed");
      setIndexingSpace(null);
    }
  }

  function startPolling() {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/confluence/spaces?local=true");
        if (res.ok) {
          const data: Space[] = await res.json();
          setSpaces(data);
          const stillIndexing = data.some((s) => s.indexStatus === "INDEXING");
          if (!stillIndexing) {
            clearInterval(interval);
            setIndexingSpace(null);
            const indexed = data.find(
              (s) => s.indexStatus === "INDEXED" && s._count.pages > 0
            );
            if (indexed) {
              toast.success("Indexing complete!");
            }
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);

    setTimeout(() => {
      clearInterval(interval);
      setIndexingSpace(null);
    }, 300000);
  }

  useEffect(() => {
    fetchSpaces();
  }, []);

  const statusColors: Record<string, string> = {
    PENDING: "secondary",
    INDEXING: "default",
    INDEXED: "default",
    FAILED: "destructive",
  };

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
        <h1 className="text-2xl font-bold text-foreground">Confluence Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect your Confluence Cloud instance to index pages and make them searchable by the AI.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Settings</CardTitle>
          <CardDescription>
            Provide your Atlassian Cloud URL and an{" "}
            <a
              href="https://id.atlassian.com/manage-profile/security/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#68c2ff] underline underline-offset-2"
            >
              API token
            </a>{" "}
            to connect. Uses the same Atlassian account as Jira.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="confluence-url">Atlassian Cloud URL</Label>
                <Input
                  id="confluence-url"
                  value={confluenceUrl}
                  onChange={(e) => setConfluenceUrl(e.target.value)}
                  placeholder="https://your-domain.atlassian.net"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confluence-email">Email</Label>
                <Input
                  id="confluence-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confluence-token">API Token</Label>
                <Input
                  id="confluence-token"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Your API token"
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={connecting}>
              {connecting ? "Connecting..." : "Connect & Sync"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {(connected || spaces.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle>Spaces</CardTitle>
                <CardDescription>
                  Include spaces for indexing, then index them to make their pages available to the AI.
                </CardDescription>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSpaces}
                  disabled={loadingSpaces}
                >
                  {loadingSpaces ? "Refreshing..." : "Refresh"}
                </Button>
                <Button
                  size="sm"
                  disabled={indexingSpace !== null}
                  onClick={async () => {
                    const included = spaces.filter((s) => s.included);
                    if (included.length === 0) {
                      toast.error("No spaces included for indexing");
                      return;
                    }
                    for (const s of included) {
                      await handleIndex(s.id);
                    }
                  }}
                >
                  Index All Included
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {spaces.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No spaces found. Click &quot;Connect &amp; Sync&quot; to fetch spaces from Confluence.
              </p>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Space</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap">Pages</TableHead>
                      <TableHead className="whitespace-nowrap">Last Indexed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spaces.map((space) => (
                      <TableRow key={space.id}>
                        <TableCell className="max-w-[260px]">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{space.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {space.key}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge
                            variant={
                              (statusColors[space.indexStatus] as "default" | "secondary" | "destructive") ||
                              "secondary"
                            }
                          >
                            {space.indexStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>{space._count.pages}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {space.lastIndexedAt
                            ? new Date(space.lastIndexedAt).toLocaleString()
                            : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end sm:gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                toggleInclude(space.id, !space.included)
                              }
                            >
                              {space.included ? "Exclude" : "Include"}
                            </Button>
                            {space.included && (
                              <Button
                                size="sm"
                                disabled={indexingSpace === space.id}
                                onClick={() => handleIndex(space.id)}
                              >
                                {indexingSpace === space.id
                                  ? "Indexing..."
                                  : space.indexStatus === "INDEXED"
                                  ? "Re-index"
                                  : "Index"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
