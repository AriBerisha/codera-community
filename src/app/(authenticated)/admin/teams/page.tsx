"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count: { members: number };
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/teams");
      if (res.ok) setTeams(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create team");
        return;
      }
      toast.success("Team created");
      setName("");
      fetchTeams();
    } catch {
      toast.error("Failed to create team");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, teamName: string) {
    if (!confirm(`Delete team "${teamName}"? All members will be removed.`))
      return;
    await fetch(`/api/admin/teams/${id}`, { method: "DELETE" });
    toast.success("Team deleted");
    fetchTeams();
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Teams</h1>
        <p className="text-muted-foreground mt-1">
          Create and manage teams. Assign users to teams to organize access.
        </p>
      </div>

      {/* Create Team */}
      <form onSubmit={handleCreate} className="flex gap-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Team name"
          className="max-w-xs"
          required
        />
        <Button type="submit" disabled={creating}>
          {creating ? "Creating..." : "Create Team"}
        </Button>
      </form>

      {/* Teams List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading teams...</p>
      ) : teams.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          No teams yet. Create one above to get started.
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Team
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Slug
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Members
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr
                  key={team.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/teams/${team.id}`}
                      className="font-medium text-foreground hover:text-[#68c2ff] transition-colors"
                    >
                      {team.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {team.slug}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {team._count.members}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(team.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/teams/${team.id}`}>
                        <Button variant="outline" size="sm">
                          Manage
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(team.id, team.name)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
