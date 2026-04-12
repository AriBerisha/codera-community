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
  githubId: number;
  name: string;
  pathWithNamespace: string;
  description: string | null;
  webUrl: string;
  defaultBranch: string;
  included: boolean;
  indexStatus: string;
  lastIndexedAt: string | null;
  _count: { files: number };
}

export default function GitHubPage() {
  const [githubUrl, setGithubUrl] = useState("https://github.com");
  const [pat, setPat] = useState("");
  const [orgName, setOrgName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [indexingProject, setIndexingProject] = useState<string | null>(null);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    try {
      const res = await fetch("/api/admin/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl, pat, orgName: orgName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Connection failed");
        return;
      }
      const target = data.org ? `org: ${data.org.login}` : `user: ${data.user.login}`;
      toast.success(`Connected as ${target}`);
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
      const res = await fetch("/api/admin/github/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        setConnected(true);
      }
    } catch {
      // GitHub not configured yet
    } finally {
      setLoadingProjects(false);
    }
  }

  async function toggleInclude(projectId: string, included: boolean) {
    try {
      await fetch("/api/admin/github/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, included }),
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, included } : p))
      );
    } catch {
      toast.error("Failed to update repository");
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
      const res = await fetch("/api/admin/github/index", {
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
        const res = await fetch("/api/admin/github/projects?local=true");
        if (res.ok) {
          const data: Project[] = await res.json();
          setProjects(data);
          const stillIndexing = data.some((p) => p.indexStatus === "INDEXING");
          if (!stillIndexing) {
            clearInterval(interval);
            setIndexingProject(null);
            const indexed = data.find(
              (p) => p.indexStatus === "INDEXED" && p._count.files > 0
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
        <h1 className="text-2xl font-bold text-foreground">GitHub Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect your GitHub account or organization and manage repository indexing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Settings</CardTitle>
          <CardDescription>
            Provide a Personal Access Token with <code>repo</code> scope. Leave Organization empty to use your personal repos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="github-url">GitHub URL</Label>
                <Input
                  id="github-url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="gh-pat">Personal Access Token</Label>
                <Input
                  id="gh-pat"
                  type="password"
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                  placeholder="ghp_..."
                  required
                />
              </div>
              <div>
                <Label htmlFor="org-name">Organization (optional)</Label>
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Leave empty for personal repos"
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
                <CardTitle>Repositories</CardTitle>
                <CardDescription>
                  Include repositories for indexing, then index them to make their code available to the AI.
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
                      toast.error("No repositories included for indexing");
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
                No repositories found. Click &quot;Connect &amp; Sync&quot; to fetch repositories from GitHub.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repository</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Last Indexed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{project.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {project.pathWithNamespace}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (statusColors[project.indexStatus] as "default" | "secondary" | "destructive") ||
                            "secondary"
                          }
                        >
                          {project.indexStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{project._count.files}</TableCell>
                      <TableCell>
                        {project.lastIndexedAt
                          ? new Date(project.lastIndexedAt).toLocaleString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
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
