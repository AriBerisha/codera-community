"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ConversationList } from "@/components/chat/conversation-list";
import { ChatInterface } from "@/components/chat/chat-interface";

interface DbMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string | null;
  projectIds: string[];
  projectBranches: Record<string, string> | null;
  integrationIds: string[];
  messages: DbMessage[];
}

export default function ChatConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/conversations/${conversationId}`);
        if (res.ok) {
          setConversation(await res.json());
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [conversationId]);

  async function handleProjectsChange(projectIds: string[], projectBranches: Record<string, string>) {
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectIds, projectBranches }),
    });
    if (conversation) {
      setConversation({ ...conversation, projectIds, projectBranches });
    }
  }

  async function handleIntegrationsChange(integrationIds: string[]) {
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integrationIds }),
    });
    if (conversation) {
      setConversation({ ...conversation, integrationIds });
    }
  }

  return (
    <div className="flex h-full">
      <div className="hidden md:block w-[240px] border-r border-[#21262d] bg-[#0d1117] shrink-0">
        <ConversationList />
      </div>
      <div className="flex-1 min-w-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-[#7d8590]">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full border-2 border-[#30363d] border-t-[#007acc] animate-spin" />
              <span className="text-[13px]">Loading...</span>
            </div>
          </div>
        ) : !conversation ? (
          <div className="flex items-center justify-center h-full text-[#7d8590]">
            Conversation not found
          </div>
        ) : (
          <ChatInterface
            conversationId={conversationId}
            initialProjectIds={conversation.projectIds}
            initialBranches={conversation.projectBranches || {}}
            initialIntegrationIds={conversation.integrationIds || []}
            onProjectsChange={handleProjectsChange}
            onIntegrationsChange={handleIntegrationsChange}
            initialMessages={(conversation.messages || []).map((m) => ({
              id: m.id,
              role: m.role === "USER" ? "user" as const : "assistant" as const,
              parts: [{ type: "text" as const, text: m.content }],
            }))}
          />
        )}
      </div>
    </div>
  );
}
