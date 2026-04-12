"use client";

import { useEffect, useState, useCallback } from "react";
import { StepProgress } from "./step-progress";
import { PlanningStep } from "./steps/planning-step";
import { ProgrammingStep } from "./steps/programming-step";
import { CommitStep } from "./steps/commit-step";
import { ProjectBadges } from "@/components/chat/project-selector";

interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  order: number;
}

interface FileChange {
  id: string;
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  language: string | null;
  status: string;
}

interface Execution {
  id: string;
  currentStepOrder: number;
  status: string;
  planText: string | null;
  workflow: { steps: WorkflowStep[] };
  fileChanges: FileChange[];
}

interface WorkflowInterfaceProps {
  conversationId: string;
  executionId: string;
  projectIds: string[];
  onProjectsChange: (ids: string[]) => void;
}

export function WorkflowInterface({
  conversationId,
  executionId,
  projectIds,
  onProjectsChange,
}: WorkflowInterfaceProps) {
  const [execution, setExecution] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchExecution = useCallback(async () => {
    const res = await fetch(`/api/workflow-executions/${executionId}`);
    if (res.ok) setExecution(await res.json());
    setLoading(false);
  }, [executionId]);

  useEffect(() => { fetchExecution(); }, [fetchExecution]);

  async function advanceStep(data?: Record<string, unknown>) {
    if (!execution) return;
    const nextStep = execution.currentStepOrder + 1;
    const res = await fetch(`/api/workflow-executions/${executionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentStepOrder: nextStep, ...data }),
    });
    if (res.ok) setExecution(await res.json());
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60 animate-spin" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[13px] text-muted-foreground">Workflow execution not found</p>
      </div>
    );
  }

  const currentStep = execution.workflow.steps[execution.currentStepOrder];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 px-3 md:px-5 py-2.5 border-b border-border/60">
        <StepProgress steps={execution.workflow.steps} currentStep={execution.currentStepOrder} />
        <ProjectBadges projectIds={projectIds} />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-hidden">
        {currentStep?.type === "PLANNING" && (
          <PlanningStep
            conversationId={conversationId}
            executionId={executionId}
            onApprove={(planText) => advanceStep({ planText })}
          />
        )}
        {currentStep?.type === "PROGRAMMING" && (
          <ProgrammingStep
            conversationId={conversationId}
            executionId={executionId}
            onComplete={() => fetchExecution()}
          />
        )}
        {currentStep?.type === "COMMIT" && (
          <CommitStep
            executionId={executionId}
            fileChanges={execution.fileChanges}
            onCommitted={() => fetchExecution()}
          />
        )}
        {!currentStep && execution.status === "COMPLETED" && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 mb-4">
                <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-[17px] font-semibold text-foreground">Workflow Complete</h3>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
