"use client";

import { useState } from "react";
import { toast } from "sonner";

interface FileChange {
  id: string;
  filePath: string;
  status: string;
}

interface CommitStepProps {
  executionId: string;
  fileChanges: FileChange[];
  onCommitted: (results: Array<{ projectId: string; commitUrl: string }>) => void;
}

export function CommitStep({ executionId, fileChanges, onCommitted }: CommitStepProps) {
  const [branch, setBranch] = useState(`ai/workflow-${Date.now()}`);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [results, setResults] = useState<Array<{ projectId: string; commitUrl: string }> | null>(null);

  const acceptedChanges = fileChanges.filter(c => c.status === "ACCEPTED");

  async function handleCommit(e: React.FormEvent) {
    e.preventDefault();
    if (!branch.trim() || !commitMessage.trim()) return;

    setCommitting(true);
    try {
      const res = await fetch(`/api/workflow-executions/${executionId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, commitMessage }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Commit failed");
        return;
      }
      setResults(data.results);
      onCommitted(data.results);
      toast.success("Changes committed successfully!");
    } catch {
      toast.error("Commit failed");
    } finally {
      setCommitting(false);
    }
  }

  if (results) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 mb-5">
            <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-[17px] font-semibold text-foreground">Changes Committed</h3>
          <p className="text-[13px] text-muted-foreground mt-1.5 mb-4">
            Branch: <span className="font-mono text-foreground">{branch}</span>
          </p>
          <div className="space-y-2">
            {results.map((r, i) => (
              <a
                key={i}
                href={r.commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-[13px] text-primary hover:underline"
              >
                View commit
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-lg px-6">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent mb-4">
            <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
          </div>
          <h3 className="text-[17px] font-semibold text-foreground">Commit Changes</h3>
          <p className="text-[13px] text-muted-foreground mt-1">
            {acceptedChanges.length} file{acceptedChanges.length !== 1 ? "s" : ""} will be committed
          </p>
        </div>

        {/* File list */}
        <div className="bg-muted/40 rounded-lg border border-border p-3 mb-5">
          <div className="space-y-1">
            {acceptedChanges.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-[12px] font-mono text-foreground/80">
                <svg className="h-3 w-3 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="truncate">{c.filePath}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Commit form */}
        <form onSubmit={handleCommit} className="space-y-4">
          <div>
            <label className="text-[13px] font-medium text-foreground block mb-1.5">Branch</label>
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              placeholder="feature/my-changes"
            />
          </div>
          <div>
            <label className="text-[13px] font-medium text-foreground block mb-1.5">Commit Message</label>
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              required
              rows={3}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none"
              placeholder="Describe the changes..."
            />
          </div>
          <button
            type="submit"
            disabled={committing || !branch.trim() || !commitMessage.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {committing ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                Committing...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Commit Changes
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
