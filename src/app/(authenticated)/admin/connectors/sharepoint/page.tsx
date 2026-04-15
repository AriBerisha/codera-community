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

interface Site {
  id: string;
  siteId: string;
  name: string;
  displayName: string;
  webUrl: string;
  included: boolean;
  indexStatus: string;
  lastIndexedAt: string | null;
  _count: { files: number };
}

export default function SharePointPage() {
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const [sites, setSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [indexingSite, setIndexingSite] = useState<string | null>(null);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    try {
      const res = await fetch("/api/admin/sharepoint/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, clientId, clientSecret }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Connection failed");
        return;
      }
      toast.success(`Connected to ${data.organization}`);
      setConnected(true);
      fetchSites();
    } catch {
      toast.error("Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function fetchSites() {
    setLoadingSites(true);
    try {
      const res = await fetch("/api/admin/sharepoint/sites");
      if (res.ok) {
        const data = await res.json();
        setSites(data);
        setConnected(true);
      }
    } catch {
      // SharePoint not configured yet
    } finally {
      setLoadingSites(false);
    }
  }

  async function toggleInclude(siteId: string, included: boolean) {
    try {
      await fetch("/api/admin/sharepoint/sites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, included }),
      });
      setSites((prev) =>
        prev.map((s) => (s.id === siteId ? { ...s, included } : s))
      );
    } catch {
      toast.error("Failed to update site");
    }
  }

  async function handleIndex(siteId: string) {
    setIndexingSite(siteId);
    setSites((prev) =>
      prev.map((s) =>
        s.id === siteId ? { ...s, indexStatus: "INDEXING" } : s
      )
    );

    try {
      const res = await fetch("/api/admin/sharepoint/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Indexing failed");
        setIndexingSite(null);
        return;
      }
      toast.success("Indexing started in background...");
      startPolling();
    } catch {
      toast.error("Indexing failed");
      setIndexingSite(null);
    }
  }

  function startPolling() {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/sharepoint/sites?local=true");
        if (res.ok) {
          const data: Site[] = await res.json();
          setSites(data);
          const stillIndexing = data.some((s) => s.indexStatus === "INDEXING");
          if (!stillIndexing) {
            clearInterval(interval);
            setIndexingSite(null);
            const indexed = data.find(
              (s) => s.indexStatus === "INDEXED" && s._count.files > 0
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
      setIndexingSite(null);
    }, 300000);
  }

  useEffect(() => {
    fetchSites();
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
        <h1 className="text-2xl font-bold text-foreground">SharePoint Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect your Microsoft 365 tenant to index SharePoint documents and make them searchable by the AI.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Settings</CardTitle>
          <CardDescription>
            Register an Azure AD app with <strong>Sites.Read.All</strong> application permission, then provide
            the tenant ID, client ID, and client secret below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sp-tenant">Azure AD Tenant ID</Label>
                <Input
                  id="sp-tenant"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp-client">Application (Client) ID</Label>
                <Input
                  id="sp-client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp-secret">Client Secret</Label>
                <Input
                  id="sp-secret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Your client secret"
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

      {(connected || sites.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle>Sites</CardTitle>
                <CardDescription>
                  Include sites for indexing, then index them to make their documents available to the AI.
                  Supported files: .docx, .txt, .md, .csv, .json, .xml, .yaml, .html, and more.
                </CardDescription>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSites}
                  disabled={loadingSites}
                >
                  {loadingSites ? "Refreshing..." : "Refresh"}
                </Button>
                <Button
                  size="sm"
                  disabled={indexingSite !== null}
                  onClick={async () => {
                    const included = sites.filter((s) => s.included);
                    if (included.length === 0) {
                      toast.error("No sites included for indexing");
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
            {sites.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No sites found. Click &quot;Connect &amp; Sync&quot; to discover SharePoint sites.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Site</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Files</TableHead>
                      <TableHead>Last Indexed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sites.map((site) => (
                      <TableRow key={site.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{site.displayName}</p>
                            <p className="text-xs text-muted-foreground">
                              {site.name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              (statusColors[site.indexStatus] as "default" | "secondary" | "destructive") ||
                              "secondary"
                            }
                          >
                            {site.indexStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>{site._count.files}</TableCell>
                        <TableCell>
                          {site.lastIndexedAt
                            ? new Date(site.lastIndexedAt).toLocaleString()
                            : "Never"}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              toggleInclude(site.id, !site.included)
                            }
                          >
                            {site.included ? "Exclude" : "Include"}
                          </Button>
                          {site.included && (
                            <Button
                              size="sm"
                              disabled={indexingSite === site.id}
                              onClick={() => handleIndex(site.id)}
                            >
                              {indexingSite === site.id
                                ? "Indexing..."
                                : site.indexStatus === "INDEXED"
                                ? "Re-index"
                                : "Index"}
                            </Button>
                          )}
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
