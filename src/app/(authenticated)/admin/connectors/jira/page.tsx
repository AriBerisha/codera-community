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

interface Project {
  id: string;
  jiraId: string;
  key: string;
  name: string;
  description: string | null;
  webUrl: string;
  included: boolean;
  indexStatus: string;
  lastIndexedAt: string | null;
  _count: { issues: number };
}

export default function JiraPage() {
  const [jiraUrl, setJiraUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [indexingProject, setIndexingProject] = useState<string | null>(null);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    try {
      const res = await fetch("/api/admin/jira/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jiraUrl, email, apiToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Connection failed");
        return;
      }
      toast.success(`Connected as ${data.user.displayName}`);
      setConnected(true);
      fetchProjects();
    } catch {
      toast.error("Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function fetchProjects() {
    setLoadingProjects(true);
    try {
      const res = await fetch("/api/admin/jira/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        setConnected(true);
      }
    } catch {
      // Jira not configured yet
    } finally {
      setLoadingProjects(false);
    }
  }

  async function toggleInclude(projectId: string, included: boolean) {
    try {
      await fetch("/api/admin/jira/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, included }),
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, included } : p))
      );
    } catch {
      toast.error("Failed to update project");
    }
  }

  async function handleIndex(projectId: string) {
    setIndexingProject(projectId);
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, indexStatus: "INDEXING" } : p
      )
    );

    try {
      const res = await fetch("/api/admin/jira/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Indexing failed");
        setIndexingProject(null);
        return;
      }
      toast.success("Indexing started in background...");
      startPolling();
    } catch {
      toast.error("Indexing failed");
      setIndexingProject(null);
    }
  }

  function startPolling() {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/jira/projects?local=true");
        if (res.ok) {
          const data: Project[] = await res.json();
          setProjects(data);
          const stillIndexing = data.some((p) => p.indexStatus === "INDEXING");
          if (!stillIndexing) {
            clearInterval(interval);
            setIndexingProject(null);
            const indexed = data.find(
              (p) => p.indexStatus === "INDEXED" && p._count.issues > 0
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
      setIndexingProject(null);
    }, 300000);
  }

  useEffect(() => {
    fetchProjects();
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
        <h1 className="text-2xl font-bold text-foreground">Jira Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect your Jira Cloud instance to sync issues and make them available to the AI.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Settings</CardTitle>
          <CardDescription>
            Provide your Jira Cloud URL and an{" "}
            <a
              href="https://id.atlassian.com/manage-profile/security/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#68c2ff] underline underline-offset-2"
            >
              API token
            </a>{" "}
            to connect. The email must match the account that generated the token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jira-url">Jira Cloud URL</Label>
                <Input
                  id="jira-url"
                  value={jiraUrl}
                  onChange={(e) => setJiraUrl(e.target.value)}
                  placeholder="https://your-domain.atlassian.net"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jira-email">Email</Label>
                <Input
                  id="jira-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jira-token">API Token</Label>
                <Input
                  id="jira-token"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Your Jira API token"
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

      {(connected || projects.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle>Projects</CardTitle>
                <CardDescription>
                  Include projects for indexing, then index them to make their issues available to the AI.
                </CardDescription>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchProjects}
                  disabled={loadingProjects}
                >
                  {loadingProjects ? "Refreshing..." : "Refresh"}
                </Button>
                <Button
                  size="sm"
                  disabled={indexingProject !== null}
                  onClick={async () => {
                    const included = projects.filter((p) => p.included);
                    if (included.length === 0) {
                      toast.error("No projects included for indexing");
                      return;
                    }
                    for (const p of included) {
                      await handleIndex(p.id);
                    }
                  }}
                >
                  Index All Included
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No projects found. Click &quot;Connect &amp; Sync&quot; to fetch projects from Jira.
              </p>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap">Issues</TableHead>
                      <TableHead className="whitespace-nowrap">Last Indexed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="max-w-[260px]">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{project.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {project.key}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge
                            variant={
                              (statusColors[project.indexStatus] as "default" | "secondary" | "destructive") ||
                              "secondary"
                            }
                          >
                            {project.indexStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>{project._count.issues}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {project.lastIndexedAt
                            ? new Date(project.lastIndexedAt).toLocaleString()
                            : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end sm:gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                toggleInclude(project.id, !project.included)
                              }
                            >
                              {project.included ? "Exclude" : "Include"}
                            </Button>
                            {project.included && (
                              <Button
                                size="sm"
                                disabled={indexingProject === project.id}
                                onClick={() => handleIndex(project.id)}
                              >
                                {indexingProject === project.id
                                  ? "Indexing..."
                                  : project.indexStatus === "INDEXED"
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
