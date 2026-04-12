"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect, useState } from "react";
import { DefaultChatTransport } from "ai";
import { MessageBubble } from "@/components/chat/message-bubble";

interface PlanningStepProps {
  conversationId: string;
  executionId: string;
  onApprove: (planText: string) => void;
}

export function PlanningStep({ conversationId, executionId, onApprove }: PlanningStepProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/workflow-chat",
      body: { conversationId, executionId },
    }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }
  }, [input]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage({ text: input });
      setInput("");
    }
  }

  // Get the last assistant message as plan text
  const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
  const planText = lastAssistant?.parts
    ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map(p => p.text).join("") || "";

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-3 md:px-6 py-4 md:py-6 space-y-5">
          {messages.length === 0 && (
            <div className="flex items-center justify-center min-h-[30vh]">
              <div className="text-center max-w-md">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent mb-3">
                  <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                  </svg>
                </div>
                <p className="text-[14px] font-medium text-foreground">Describe what you want to build</p>
                <p className="text-[13px] text-muted-foreground mt-1">The AI will analyze your codebase and create a plan.</p>
              </div>
            </div>
          )}

          {messages.map((message) => {
            const textContent = message.parts
              ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map(p => p.text).join("") || "";
            return (
              <MessageBubble key={message.id} role={message.role as "user" | "assistant"} content={textContent} />
            );
          })}

          {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                <svg className="h-3.5 w-3.5 text-primary animate-subtle-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-subtle-pulse" />
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-subtle-pulse [animation-delay:300ms]" />
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-subtle-pulse [animation-delay:600ms]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/60 bg-background">
        <div className="max-w-3xl mx-auto px-3 md:px-6 py-3 space-y-3">
          {planText && !isLoading && (
            <button
              onClick={() => onApprove(planText)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Approve Plan & Continue
            </button>
          )}
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-card shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                placeholder="Describe the task..."
                className="flex-1 resize-none bg-transparent px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none min-h-[44px] max-h-[120px]"
                rows={1}
              />
              <button type="submit" disabled={isLoading || !input.trim()} className="m-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
