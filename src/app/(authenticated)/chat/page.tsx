"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConversationList } from "@/components/chat/conversation-list";
import { brand } from "@/lib/brand";

export default function ChatPage() {
  const router = useRouter();

  async function createAndRedirect() {
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

  return (
    <div className="flex h-full">
      {/* Conversation list — hidden on mobile, shown on md+ */}
      <div className="hidden md:block w-[240px] border-r border-[#21262d] bg-[#0d1117] shrink-0">
        <ConversationList />
      </div>

      {/* Mobile: show conversation list as primary content */}
      <div className="flex-1 flex flex-col md:hidden">
        <ConversationList />
      </div>

      {/* Desktop: welcome screen */}
      <div className="flex-1 hidden md:flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <div className="relative inline-block mb-6">
            <img src={brand.logo} alt={brand.name} className="h-16 mx-auto object-contain relative z-10" />
            <div className="absolute inset-0 bg-[#007acc]/10 blur-2xl rounded-full scale-150" />
          </div>
          <p className="text-[13px] text-[#7d8590] leading-relaxed">
            {brand.chatDescription}
          </p>
          <button
            onClick={createAndRedirect}
            className="mt-6 inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#007acc] text-white rounded-lg text-[13px] font-medium hover:bg-[#0587de] transition-all shadow-lg shadow-[#007acc]/20"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Start New Chat
          </button>
        </div>
      </div>
    </div>
  );
}
