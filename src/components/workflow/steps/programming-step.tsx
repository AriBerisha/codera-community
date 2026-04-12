"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect, useState, useCallback } from "react";
import { DefaultChatTransport } from "ai";
import { MessageBubble } from "@/components/chat/message-bubble";
import { MonacoDiffViewer } from "@/components/editor/monaco-diff-viewer";
import { toast } from "sonner";

interface FileChange {
  id: string;
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  language: string | null;
  status: string;
}

interface ProgrammingStepProps {
  conversationId: string;
  executionId: string;
  onComplete: () => void;
}

export function ProgrammingStep({ conversationId, executionId, onComplete }: ProgrammingStepProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"chat" | "changes">("chat");

  // Commit state
  const [branch, setBranch] = useState(`ai/workflow-${Date.now()}`);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitResults, setCommitResults] = useState<Array<{ projectId: string; commitUrl: string }> | null>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/workflow-chat",
      body: { conversationId, executionId },
    }),
  });

  const isLoading = status === "streaming" || status === "submitted";
  const activeFile = fileChanges.find(c => c.id === activeFileId) || null;

  const fetchFileChanges = useCallback(async () => {
    const res = await fetch(`/api/workflow-executions/${executionId}/file-changes`);
    if (res.ok) {
      const data: FileChange[] = await res.json();
      setFileChanges(data);
      if (data.length > 0 && !activeFileId) setActiveFileId(data[0].id);
      return data.length;
    }
    return 0;
  }, [executionId, activeFileId]);

  // Poll for file changes after AI finishes
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasStreaming = prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    prevStatusRef.current = status;

    if (status === "ready" && wasStreaming && messages.length > 0) {
      let attempts = 0;
      const poll = async () => {
        const count = await fetchFileChanges();
        attempts++;
        if (count === 0 && attempts < 6) {
          setTimeout(poll, 1500);
        }
      };
      setTimeout(poll, 1000);
    }
  }, [status, messages.length, fetchFileChanges]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }
  }, [input]);

  useEffect(() => { fetchFileChanges(); }, [fetchFileChanges]);

  async function updateChangeStatus(changeId: string, newStatus: string) {
    await fetch(`/api/workflow-executions/${executionId}/file-changes/${changeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setFileChanges(prev => prev.map(c => c.id === changeId ? { ...c, status: newStatus } : c));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage({ text: input });
      setInput("");
    }
  }

  async function handleCommit() {
    if (!branch.trim() || !commitMessage.trim()) {
      toast.error("Branch name and commit message are required");
      return;
    }
    // Auto-accept all pending changes before committing
    const pending = fileChanges.filter(c => c.status === "PENDING");
    for (const c of pending) {
      await updateChangeStatus(c.id, "ACCEPTED");
    }

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
      setCommitResults(data.results);
      toast.success("Changes committed successfully!");
      onComplete();
    } catch {
      toast.error("Commit failed");
    } finally {
      setCommitting(false);
    }
  }

  const acceptedOrPending = fileChanges.filter(c => c.status === "ACCEPTED" || c.status === "PENDING").length;
  const panelOpen = fileChanges.length > 0;

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Mobile tab bar when changes exist */}
      {panelOpen && (
        <div className="flex md:hidden border-b border-border/60 bg-background shrink-0">
          <button
            onClick={() => setMobileView("chat")}
            className={`flex-1 py-2 text-[13px] font-medium text-center transition-colors ${
              mobileView === "chat" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setMobileView("changes")}
            className={`flex-1 py-2 text-[13px] font-medium text-center transition-colors ${
              mobileView === "changes" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            Changes ({fileChanges.length})
          </button>
        </div>
      )}

      {/* Chat panel */}
      <div className={`flex-col border-r border-border/60 transition-all duration-300 ${
        panelOpen
          ? `${mobileView === "changes" ? "hidden md:flex" : "flex"} md:w-[380px] md:min-w-[340px] flex-1 md:flex-initial`
          : "flex flex-1"
      }`}>
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent mb-3">
                  <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                </div>
                <p className="text-[13px] font-medium text-foreground">Implement the plan</p>
                <p className="text-[12px] text-muted-foreground mt-1">Ask the AI to write code. Diffs will appear on the right.</p>
              </div>
            )}
            {messages.map((message) => {
              const textContent = message.parts
                ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map(p => p.text).join("") || "";
              const displayContent = textContent
                .replace(/<file_edit>[\s\S]*?<\/file_edit>/g, "")
                .replace(/<file_edit>[\s\S]*$/g, "")
                .trim();
              if (!displayContent) return null;
              return (
                <MessageBubble key={message.id} role={message.role as "user" | "assistant"} content={displayContent} />
              );
            })}
            {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-center gap-1.5 px-3 py-2">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-subtle-pulse" />
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-subtle-pulse [animation-delay:300ms]" />
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-subtle-pulse [animation-delay:600ms]" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-border/60 px-4 py-3">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-card shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                placeholder="Ask for changes..."
                className="flex-1 resize-none bg-transparent px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none min-h-[40px] max-h-[100px]"
                rows={1}
              />
              <button type="submit" disabled={isLoading || !input.trim()} className="m-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right panel — file diffs + commit */}
      {panelOpen && (
        <div className={`flex-1 flex-col overflow-hidden bg-[#0d1117] ${
          mobileView === "changes" ? "flex" : "hidden md:flex"
        }`}>
          {/* File tabs */}
          <div className="flex items-center bg-[#161b22] border-b border-[#30363d] overflow-x-auto">
            {fileChanges.map((change) => {
              const isActive = activeFileId === change.id;
              const fileName = change.filePath.split("/").pop();
              return (
                <button
                  key={change.id}
                  onClick={() => setActiveFileId(change.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-mono border-r border-[#30363d] shrink-0 transition-colors ${
                    isActive
                      ? "bg-[#0d1117] text-[#c9d1d9]"
                      : "bg-[#1c2129] text-[#7d8590] hover:text-[#c9d1d9]"
                  }`}
                >
                  {change.status === "ACCEPTED" && (
                    <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  )}
                  {change.status === "REJECTED" && (
                    <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                  )}
                  {change.status === "PENDING" && (
                    <span className="h-2 w-2 rounded-full bg-yellow-500 shrink-0" />
                  )}
                  {change.status === "COMMITTED" && (
                    <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                  )}
                  <span>{fileName}</span>
                </button>
              );
            })}
          </div>

          {/* File path + actions bar */}
          {activeFile && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-[#30363d]">
              <span className="text-[11px] font-mono text-[#7d8590] truncate">
                {activeFile.filePath}
                {!activeFile.originalContent.trim() && (
                  <span className="ml-2 text-[10px] font-sans font-medium bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">NEW</span>
                )}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {activeFile.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => updateChangeStatus(activeFile.id, "ACCEPTED")}
                      className="text-[11px] font-medium px-2 py-0.5 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => updateChangeStatus(activeFile.id, "REJECTED")}
                      className="text-[11px] font-medium px-2 py-0.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
                {activeFile.status === "ACCEPTED" && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-green-500/15 text-green-400">Accepted</span>
                )}
                {activeFile.status === "REJECTED" && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-red-500/15 text-red-400">Rejected</span>
                )}
                {activeFile.status === "COMMITTED" && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-blue-500/15 text-blue-400">Committed</span>
                )}
              </div>
            </div>
          )}

          {/* Monaco diff editor — full height */}
          <div className="flex-1 min-h-0">
            {activeFile ? (
              <MonacoDiffViewer
                language={activeFile.language}
                original={activeFile.originalContent}
                modified={activeFile.modifiedContent}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-[13px] text-[#7d8590]">Select a file to view changes</p>
              </div>
            )}
          </div>

          {/* Commit bar — pinned to bottom */}
          {!commitResults && acceptedOrPending > 0 && (
            <div className="border-t border-[#30363d] bg-[#161b22] px-3 md:px-4 py-3">
              <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-3">
                <div className="flex-1 flex flex-col md:flex-row gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="text-[11px] font-medium text-[#7d8590] block mb-1">Branch</label>
                    <input
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-[12px] font-mono text-[#c9d1d9] focus:outline-none focus:border-[#007acc] placeholder:text-[#484f58]"
                      placeholder="feature/my-changes"
                    />
                  </div>
                  <div className="flex-[2] min-w-0">
                    <label className="text-[11px] font-medium text-[#7d8590] block mb-1">Commit message</label>
                    <input
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-[12px] text-[#c9d1d9] focus:outline-none focus:border-[#007acc] placeholder:text-[#484f58]"
                      placeholder="Describe the changes..."
                    />
                  </div>
                </div>
                <button
                  onClick={handleCommit}
                  disabled={committing || !branch.trim() || !commitMessage.trim()}
                  className="flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md bg-[#007acc] text-white text-[12px] font-medium hover:bg-[#0062a3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {committing ? (
                    <>
                      <div className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Committing...
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Commit ({acceptedOrPending} file{acceptedOrPending !== 1 ? "s" : ""})
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Commit success */}
          {commitResults && (
            <div className="border-t border-[#30363d] bg-[#161b22] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-green-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[12px] font-medium">Committed to <span className="font-mono">{branch}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  {commitResults.map((r, i) => (
                    <a
                      key={i}
                      href={r.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-[#68c2ff] hover:underline flex items-center gap-1"
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
          )}
        </div>
      )}
    </div>
  );
}
