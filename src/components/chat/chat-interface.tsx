"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ProjectSelector, ProjectBadges } from "./project-selector";
import { IntegrationSelector, IntegrationBadges } from "./integration-selector";
import { MessageBubble } from "./message-bubble";
import { MonacoDiffViewer } from "@/components/editor/monaco-diff-viewer";
import { DefaultChatTransport } from "ai";
import { toast } from "sonner";
import type { UIMessage } from "ai";

interface FileChange {
  id: string;
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  language: string | null;
  status: string;
}

interface ChatInterfaceProps {
  conversationId: string;
  initialProjectIds: string[];
  initialBranches: Record<string, string>;
  initialIntegrationIds?: string[];
  onProjectsChange: (ids: string[], branches: Record<string, string>) => void;
  onIntegrationsChange?: (ids: string[]) => void;
  initialMessages?: UIMessage[];
}

export function ChatInterface({
  conversationId,
  initialProjectIds,
  initialBranches,
  initialIntegrationIds = [],
  onProjectsChange,
  onIntegrationsChange,
  initialMessages,
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  // File changes state
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // Mobile: toggle between chat and diff views
  const [mobileView, setMobileView] = useState<"chat" | "changes">("chat");

  // Commit state
  const [branch, setBranch] = useState(`ai/chat-${Date.now()}`);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitResults, setCommitResults] = useState<Array<{ projectId: string; commitUrl: string }> | null>(null);

  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { conversationId },
    }),
  });

  const isLoading = status === "streaming" || status === "submitted";
  const activeFile = fileChanges.find(c => c.id === activeFileId) || null;
  const panelOpen = fileChanges.length > 0;
  const committableCount = fileChanges.filter(c => c.status === "ACCEPTED" || c.status === "PENDING").length;

  // Fetch file changes
  const fetchFileChanges = useCallback(async () => {
    const res = await fetch(`/api/conversations/${conversationId}/file-changes`);
    if (res.ok) {
      const data: FileChange[] = await res.json();
      setFileChanges(data);
      if (data.length > 0 && !activeFileId) setActiveFileId(data[0].id);
      return data.length;
    }
    return 0;
  }, [conversationId, activeFileId]);

  // Poll for file changes after AI finishes
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasStreaming = prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    prevStatusRef.current = status;

    if (status === "ready" && wasStreaming && messages.length > 0) {
      let attempts = 0;
      const prevCount = fileChanges.length;
      const poll = async () => {
        const count = await fetchFileChanges();
        attempts++;
        // Keep polling if no new changes appeared yet
        if (count <= prevCount && attempts < 8) {
          setTimeout(poll, 1500);
        }
      };
      setTimeout(poll, 1000);
    }
  }, [status, messages.length, fetchFileChanges, fileChanges.length]);

  // Initial fetch
  useEffect(() => { fetchFileChanges(); }, [fetchFileChanges]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 80) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowJumpToBottom(distanceFromBottom > 200);
    };
    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }, [input]);

  async function updateChangeStatus(changeId: string, newStatus: string) {
    await fetch(`/api/conversations/${conversationId}/file-changes/${changeId}`, {
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

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  async function handleCommit() {
    if (!branch.trim() || !commitMessage.trim()) {
      toast.error("Branch name and commit message are required");
      return;
    }
    // Auto-accept pending changes
    const pending = fileChanges.filter(c => c.status === "PENDING");
    for (const c of pending) {
      await updateChangeStatus(c.id, "ACCEPTED");
    }

    setCommitting(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/commit`, {
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
      setFileChanges(prev => prev.map(c => ({ ...c, status: "COMMITTED" })));
      toast.success("Changes committed successfully!");
    } catch {
      toast.error("Commit failed");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="flex flex-col md:flex-row h-full bg-background">
      {/* Mobile tab bar when changes exist */}
      {panelOpen && (
        <div className="flex md:hidden border-b border-border/60 bg-background shrink-0">
          <button
            onClick={() => setMobileView("chat")}
            className={`flex-1 py-2 text-[13px] font-medium text-center transition-colors ${
              mobileView === "chat"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setMobileView("changes")}
            className={`flex-1 py-2 text-[13px] font-medium text-center transition-colors ${
              mobileView === "changes"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
          >
            Changes ({fileChanges.length})
          </button>
        </div>
      )}

      {/* Left side — chat */}
      <div className={`flex-col transition-all duration-300 ${
        panelOpen
          ? `${mobileView === "changes" ? "hidden md:flex" : "flex"} md:w-[420px] md:min-w-[360px] flex-1 md:flex-initial`
          : "flex flex-1"
      }`}>
        {/* Repository + integration selectors (new chat) or badges (existing chat) + Workflow button */}
        <div className="flex items-center justify-between border-b border-border/60 px-3 md:px-6 py-2.5 gap-2">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            {initialMessages && initialMessages.length > 0 ? (
              <>
                <ProjectBadges projectIds={initialProjectIds} branches={initialBranches} />
                <IntegrationBadges integrationIds={initialIntegrationIds} />
              </>
            ) : (
              <>
                <ProjectSelector
                  selectedIds={initialProjectIds}
                  branches={initialBranches}
                  onChange={onProjectsChange}
                />
                {onIntegrationsChange && (
                  <IntegrationSelector
                    selectedIds={initialIntegrationIds}
                    onChange={onIntegrationsChange}
                  />
                )}
              </>
            )}
          </div>
          <WorkflowLauncher conversationId={conversationId} />
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
          <div className={`mx-auto px-3 md:px-6 py-4 md:py-6 space-y-5 ${panelOpen ? "" : "max-w-3xl"}`}>
            {messages.length === 0 && (
              <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                  <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#007acc]/10 ring-1 ring-[#007acc]/20 mb-4">
                    <svg className="h-6 w-6 text-[#68c2ff]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                  </div>
                  <p className="text-[15px] font-medium text-foreground">Start a conversation</p>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    Select repositories above and ask about your code
                  </p>
                </div>
              </div>
            )}

            {messages.map((message) => {
              const textContent = message.parts
                ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map((p) => p.text)
                .join("") || "";
              // Strip complete <file_edit> blocks AND partial ones still streaming
              const displayContent = textContent
                .replace(/<file_edit>[\s\S]*?<\/file_edit>/g, "")
                .replace(/<file_edit>[\s\S]*$/g, "")
                .trim();
              if (!displayContent) return null;

              return (
                <MessageBubble
                  key={message.id}
                  role={message.role as "user" | "assistant"}
                  content={displayContent}
                />
              );
            })}

            {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#007acc]/10 ring-1 ring-[#007acc]/20 mt-0.5">
                  <svg className="h-3.5 w-3.5 text-[#68c2ff] animate-subtle-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                </div>
                <div className="dot-pulse flex items-center gap-1.5 pt-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#68c2ff]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#68c2ff]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#68c2ff]" />
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-2 bg-destructive/5 text-destructive border border-destructive/10 rounded-lg px-4 py-2.5 text-[13px]">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error.message}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="relative border-t border-border/60 bg-background">
          {showJumpToBottom && (
            <button
              type="button"
              onClick={scrollToBottom}
              aria-label="Scroll to bottom"
              className="absolute left-1/2 -top-12 -translate-x-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md hover:text-foreground hover:bg-muted transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
              </svg>
            </button>
          )}
          <div className={`mx-auto px-3 md:px-6 py-3 md:py-4 ${panelOpen ? "" : "max-w-3xl"}`}>
            <form onSubmit={handleSubmit} className="relative">
              <div className="flex items-end gap-2 rounded-xl border border-border bg-card shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Ask about your code..."
                  className="flex-1 resize-none bg-transparent px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none min-h-[44px] max-h-[160px]"
                  rows={1}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="m-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Right panel — file diffs + commit */}
      {panelOpen && (
        <div className={`flex-1 flex-col overflow-hidden bg-[#0d1117] md:border-l border-[#30363d] ${
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

          {/* Commit bar */}
          {!commitResults && committableCount > 0 && (
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
                      Commit ({committableCount} file{committableCount !== 1 ? "s" : ""})
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

function WorkflowLauncher({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string; description: string | null }>>([]);
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (open && workflows.length === 0) {
      fetch("/api/workflows").then(r => r.ok ? r.json() : []).then(setWorkflows).catch(() => {});
    }
  }, [open, workflows.length]);

  async function startWorkflow(workflowId: string) {
    setStarting(true);
    try {
      const res = await fetch("/api/workflow-executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, workflowId }),
      });
      if (res.ok) {
        const exec = await res.json();
        router.push(`/chat/${conversationId}/workflow?exec=${exec.id}`);
      }
    } finally {
      setStarting(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={starting}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[12px] font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground transition-all"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        Workflow
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border border-border bg-card shadow-lg py-1">
            {workflows.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-muted-foreground">No workflows available</p>
            ) : (
              workflows.map(w => (
                <button
                  key={w.id}
                  onClick={() => startWorkflow(w.id)}
                  className="w-full text-left px-3 py-2 text-[13px] hover:bg-accent transition-colors"
                >
                  <p className="font-medium text-foreground">{w.name}</p>
                  {w.description && <p className="text-[11px] text-muted-foreground mt-0.5">{w.description}</p>}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
