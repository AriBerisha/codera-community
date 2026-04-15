"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  userEmail: string;
  userRole: string;
}

export function UserProfileModal({
  open,
  onOpenChange,
  userName,
  userEmail,
  userRole,
}: UserProfileModalProps) {
  const [name, setName] = useState(userName);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name === userName) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update name");
        return;
      }
      toast.success("Name updated");
      // Refresh the page to update session/sidebar
      window.location.reload();
    } catch {
      toast.error("Failed to update name");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearChats() {
    if (!confirm("This will permanently delete all your conversations. Continue?"))
      return;
    setClearing(true);
    try {
      const res = await fetch("/api/user/conversations", { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to clear conversations");
        return;
      }
      const data = await res.json();
      toast.success(`Cleared ${data.deleted} conversation${data.deleted !== 1 ? "s" : ""}`);
      // Refresh to update conversation list
      window.location.reload();
    } catch {
      toast.error("Failed to clear conversations");
    } finally {
      setClearing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>Manage your account settings.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* User Info */}
          <form onSubmit={handleSaveName} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={userEmail} disabled className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value={userRole.charAt(0) + userRole.slice(1).toLowerCase()}
                disabled
                className="opacity-60"
              />
            </div>
            {name.trim() !== userName && name.trim().length > 0 && (
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving..." : "Save Name"}
              </Button>
            )}
          </form>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Clear Chats */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              Clear Conversations
            </p>
            <p className="text-xs text-muted-foreground">
              Permanently delete all your chat conversations. This cannot be
              undone.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearChats}
              disabled={clearing}
              className="text-red-400 hover:text-red-300 border-red-400/30 hover:border-red-400/50"
            >
              {clearing ? "Clearing..." : "Clear All Chats"}
            </Button>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Sign Out */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full"
          >
            Sign Out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
