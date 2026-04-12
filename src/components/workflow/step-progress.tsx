"use client";

import { cn } from "@/lib/utils";

interface Step {
  name: string;
  type: string;
  order: number;
}

interface StepProgressProps {
  steps: Step[];
  currentStep: number;
}

export function StepProgress({ steps, currentStep }: StepProgressProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {steps.map((step, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        return (
          <div key={step.order} className="flex items-center gap-1">
            {i > 0 && (
              <div className={cn(
                "w-8 h-px",
                isCompleted ? "bg-primary" : "bg-border"
              )} />
            )}
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
                isCompleted && "bg-primary text-primary-foreground",
                isCurrent && "bg-primary/15 text-primary ring-1 ring-primary/30",
                !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
              )}>
                {isCompleted ? (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={cn(
                "text-[12px] font-medium",
                isCurrent ? "text-foreground" : "text-muted-foreground"
              )}>
                {step.name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
