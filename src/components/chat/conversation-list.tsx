"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
  _count: { messages: number };
}

export function ConversationList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  async function fetchConversations() {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        setConversations(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchConversations();
  }, [pathname]);

  async function createConversation() {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || `Could not start a new chat (HTTP ${res.status})`);
        return;
      }
      const conv = await res.json();
      router.push(`/chat/${conv.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error starting chat");
    }
  }

  async function deleteConversation(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (pathname === `/chat/${id}`) {
        router.push("/chat");
      }
    }
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 pb-2">
        <button
          onClick={createConversation}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-[7px] rounded-lg text-[13px] font-medium bg-[#007acc] text-white hover:bg-[#0587de] transition-all shadow-sm shadow-[#007acc]/10"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-4 w-4 rounded-full border-2 border-[#30363d] border-t-[#007acc] animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-[12px] text-[#7d8590] px-3 py-4 text-center">
            No conversations yet
          </p>
        ) : (
          <div className="space-y-px">
            {conversations.map((conv) => {
              const isActive = pathname === `/chat/${conv.id}`;
              return (
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-center rounded-lg transition-all duration-150",
                    isActive
                      ? "bg-[#007acc]/10 shadow-[inset_0_0_0_1px_rgba(0,122,204,0.15)]"
                      : "hover:bg-[#21262d]"
                  )}
                >
                  <Link
                    href={`/chat/${conv.id}`}
                    className="flex-1 min-w-0 px-3 py-2"
                  >
                    <p className={cn(
                      "text-[13px] truncate leading-tight",
                      isActive ? "font-medium text-[#c9d1d9]" : "text-[#c9d1d9]/80"
                    )}>
                      {conv.title || "Untitled"}
                    </p>
                    <p className="text-[11px] text-[#7d8590] mt-0.5 leading-tight">
                      {formatTime(conv.updatedAt)}
                    </p>
                  </Link>
                  <button
                    onClick={(e) => deleteConversation(e, conv.id)}
                    className="hidden group-hover:flex items-center justify-center w-6 h-6 mr-1.5 rounded text-[#7d8590] hover:text-[#f85149] transition-colors"
                    title="Delete"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
