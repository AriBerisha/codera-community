"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Memory {
  id: string;
  title: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string | null; email: string } | null;
}

interface TeamSummary {
  id: string;
  name: string;
}

export default function TeamMemoriesPage() {
  const { id } = useParams<{ id: string }>();
  const [team, setTeam] = useState<TeamSummary | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  // New memory form
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, memRes] = await Promise.all([
        fetch(`/api/admin/teams/${id}`),
        fetch(`/api/admin/teams/${id}/memories`),
      ]);
      if (teamRes.ok) {
        const t = await teamRes.json();
        setTeam({ id: t.id, name: t.name });
      }
      if (memRes.ok) {
        setMemories(await memRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newContent.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/teams/${id}/memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, content: newContent }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save memory");
        return;
      }
      toast.success("Memory saved");
      setNewTitle("");
      setNewContent("");
      fetchAll();
    } finally {
      setCreating(false);
    }
  }

  function startEdit(m: Memory) {
    setEditingId(m.id);
    setEditTitle(m.title ?? "");
    setEditContent(m.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  }

  async function saveEdit(memoryId: string) {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/teams/${id}/memories/${memoryId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: editTitle, content: editContent }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update memory");
        return;
      }
      toast.success("Memory updated");
      cancelEdit();
      fetchAll();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(memoryId: string) {
    if (!confirm("Delete this memory? This cannot be undone.")) return;
    const res = await fetch(
      `/api/admin/teams/${id}/memories/${memoryId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      toast.error("Failed to delete memory");
      return;
    }
    toast.success("Memory deleted");
    fetchAll();
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/admin/teams/${id}`}
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {team?.name ?? "Team"}
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Memories</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Durable knowledge the team and AI both share. Use it for decisions,
          conventions, glossary entries — anything the AI should remember
          across chats.
        </p>
      </div>

      {/* New memory */}
      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-border bg-card p-4 space-y-3"
      >
        <h2 className="text-sm font-semibold text-foreground">Add memory</h2>
        <div className="space-y-1">
          <Label className="text-xs">Title (optional)</Label>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Short label, e.g. 'Deploy cadence'"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Content</Label>
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write the memory as self-contained durable knowledge..."
            rows={4}
            required
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={creating || !newContent.trim()}>
            {creating ? "Saving..." : "Save memory"}
          </Button>
        </div>
      </form>

      {/* List */}
      <div className="space-y-3">
        <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
          {memories.length === 0 ? "No memories yet" : `${memories.length} ${memories.length === 1 ? "memory" : "memories"}`}
        </h2>

        {memories.map((m) => {
          const isEditing = editingId === m.id;
          const authorLabel = m.createdBy
            ? (m.createdBy.name || m.createdBy.email)
            : "AI";
          return (
            <div
              key={m.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              {isEditing ? (
                <div className="space-y-3">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Title (optional)"
                  />
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={5}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveEdit(m.id)}
                      disabled={saving || !editContent.trim()}
                    >
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {m.title && (
                        <h3 className="text-sm font-semibold text-foreground mb-1">
                          {m.title}
                        </h3>
                      )}
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {m.content}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(m)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(m.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Saved by {authorLabel} ·{" "}
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
