"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string | null; email: string; role: string };
}

interface Team {
  id: string;
  name: string;
  slug: string;
  enabledIntegrations: string[];
  createdAt: string;
  members: TeamMember[];
}

interface Integration {
  value: string;
  label: string;
}

interface AppUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit name
  const [editingName, setEditingName] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Integrations
  const [availableIntegrations, setAvailableIntegrations] = useState<Integration[]>([]);

  // Add member
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("MEMBER");
  const [addingMember, setAddingMember] = useState(false);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/teams/${id}`);
      if (!res.ok) {
        router.push("/admin/teams");
        return;
      }
      const data = await res.json();
      setTeam(data);
      setTeamName(data.name);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setAllUsers(await res.json());
  }, []);

  const fetchIntegrations = useCallback(async () => {
    const res = await fetch("/api/integrations");
    if (res.ok) setAvailableIntegrations(await res.json());
  }, []);

  useEffect(() => {
    fetchTeam();
    fetchUsers();
    fetchIntegrations();
  }, [fetchTeam, fetchUsers, fetchIntegrations]);

  async function handleSaveName() {
    if (!teamName.trim() || teamName === team?.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch(`/api/admin/teams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName.trim() }),
      });
      if (res.ok) {
        toast.success("Team name updated");
        fetchTeam();
      }
    } finally {
      setSavingName(false);
      setEditingName(false);
    }
  }

  async function handleToggleIntegration(integration: string) {
    if (!team) return;
    const current = team.enabledIntegrations;
    const updated = current.includes(integration)
      ? current.filter((i) => i !== integration)
      : [...current, integration];

    // Optimistic update
    setTeam({ ...team, enabledIntegrations: updated });

    await fetch(`/api/admin/teams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabledIntegrations: updated }),
    });
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/admin/teams/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to add member");
        return;
      }
      toast.success("Member added");
      setSelectedUserId("");
      setSelectedRole("MEMBER");
      fetchTeam();
    } catch {
      toast.error("Failed to add member");
    } finally {
      setAddingMember(false);
    }
  }

  async function handleChangeRole(memberId: string, role: string) {
    await fetch(`/api/admin/teams/${id}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    fetchTeam();
  }

  async function handleRemoveMember(memberId: string, userName: string | null) {
    if (!confirm(`Remove ${userName || "this user"} from the team?`)) return;
    await fetch(`/api/admin/teams/${id}/members/${memberId}`, {
      method: "DELETE",
    });
    toast.success("Member removed");
    fetchTeam();
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!team) return null;

  // Users not already in this team
  const memberUserIds = new Set(team.members.map((m) => m.user.id));
  const availableUsers = allUsers.filter((u) => !memberUserIds.has(u.id));

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/teams"
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
          Teams
        </Link>

        <div className="flex items-center gap-3">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="text-xl font-bold h-9 max-w-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
                    setTeamName(team.name);
                    setEditingName(false);
                  }
                }}
              />
              <Button size="sm" onClick={handleSaveName} disabled={savingName}>
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTeamName(team.name);
                  setEditingName(false);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground">
                {team.name}
              </h1>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingName(true)}
              >
                Rename
              </Button>
            </>
          )}
        </div>
        <p className="text-muted-foreground mt-1 text-sm font-mono">
          {team.slug}
        </p>
      </div>

      {/* Integrations */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-1">
          Integrations
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Toggle which data sources team members can access in chat and
          automations.
        </p>
        {availableIntegrations.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No integrations configured yet. Set them up in{" "}
            <Link
              href="/admin/connectors"
              className="text-[#68c2ff] underline underline-offset-2"
            >
              Connectors
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableIntegrations
              .filter((i) => i.value !== "resend")
              .map((integration) => {
                const enabled = team.enabledIntegrations.includes(
                  integration.value
                );
                return (
                  <button
                    key={integration.value}
                    onClick={() =>
                      handleToggleIntegration(integration.value)
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      enabled
                        ? "border-[#68c2ff]/40 bg-[#68c2ff]/10 text-[#68c2ff]"
                        : "border-border text-muted-foreground hover:border-[#7d8590]"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        enabled ? "bg-[#68c2ff]" : "bg-[#7d8590]"
                      }`}
                    />
                    {integration.label}
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* Add Member */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Add Member
        </h2>
        {availableUsers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            All users are already members of this team.
          </p>
        ) : (
          <form onSubmit={handleAddMember} className="flex items-end gap-3">
            <div className="space-y-1 flex-1 max-w-xs">
              <Label className="text-xs">User</Label>
              <Select
                value={selectedUserId}
                onValueChange={(v) => setSelectedUserId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}{" "}
                      <span className="text-muted-foreground">
                        ({user.email})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 w-32">
              <Label className="text-xs">Role</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v ?? "MEMBER")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="OWNER">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={addingMember || !selectedUserId}>
              {addingMember ? "Adding..." : "Add"}
            </Button>
          </form>
        )}
      </div>

      {/* Members List */}
      <div>
        <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Members ({team.members.length})
        </h2>
        {team.members.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
            No members yet. Add users above.
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Team Role
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {team.members.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {member.user.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {member.user.email}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={member.role}
                        onValueChange={(role) =>
                          role && handleChangeRole(member.id, role)
                        }
                      >
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MEMBER">Member</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="OWNER">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleRemoveMember(member.id, member.user.name)
                        }
                        className="text-red-400 hover:text-red-300"
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
