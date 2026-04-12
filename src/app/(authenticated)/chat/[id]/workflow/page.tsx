"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ConversationList } from "@/components/chat/conversation-list";
import { WorkflowInterface } from "@/components/workflow/workflow-interface";

export default function WorkflowPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const conversationId = params.id as string;
  const executionId = searchParams.get("exec");

  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [currentExecId, setCurrentExecId] = useState<string | null>(executionId);
  const [loading, setLoading] = useState(!executionId);

  useEffect(() => {
    // Load conversation to get projectIds
    fetch(`/api/conversations/${conversationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setProjectIds(data.projectIds || []);
      });
  }, [conversationId]);

  useEffect(() => {
    if (executionId) {
      setCurrentExecId(executionId);
      setLoading(false);
      return;
    }

    // Check for existing in-progress execution
    async function findOrCreate() {
      // For now, just show loading until we have an executionId
      setLoading(false);
    }
    findOrCreate();
  }, [executionId]);

  async function handleProjectsChange(ids: string[]) {
    setProjectIds(ids);
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectIds: ids }),
    });
  }

  return (
    <div className="flex h-full">
      <div className="hidden md:block w-[240px] border-r border-border/60 bg-background shrink-0">
        <ConversationList />
      </div>
      <div className="flex-1 min-w-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60 animate-spin" />
          </div>
        ) : currentExecId ? (
          <WorkflowInterface
            conversationId={conversationId}
            executionId={currentExecId}
            projectIds={projectIds}
            onProjectsChange={handleProjectsChange}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[13px] text-muted-foreground">No workflow execution found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
