"use client";

import { useEffect, useState, useRef } from "react";

interface IntegrationOption {
  value: string;
  label: string;
}

interface IntegrationSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

// GitLab and GitHub have their own first-class picker (the Repositories
// selector). Including them here is redundant — selecting a repo IS the
// signal that the user wants code context from that source.
const CODE_SOURCE_INTEGRATIONS = new Set(["gitlab", "github"]);

export function IntegrationSelector({ selectedIds, onChange, disabled }: IntegrationSelectorProps) {
  const [integrations, setIntegrations] = useState<IntegrationOption[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: IntegrationOption[]) =>
        setIntegrations(data.filter((i) => !CODE_SOURCE_INTEGRATIONS.has(i.value)))
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(value: string) {
    if (disabled) return;
    if (selectedIds.includes(value)) {
      onChange(selectedIds.filter((v) => v !== value));
    } else {
      onChange([...selectedIds, value]);
    }
  }

  function selectAll() {
    if (disabled) return;
    onChange(integrations.map((i) => i.value));
  }

  function deselectAll() {
    if (disabled) return;
    onChange([]);
  }

  const allSelected = integrations.length > 0 && selectedIds.length === integrations.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < integrations.length;
  const count = selectedIds.length === 0 ? "All" : String(selectedIds.length);

  if (integrations.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap" ref={dropdownRef}>
      <div className="relative">
        <button
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[12px] font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5h6m0 0v6m0-6L10.5 13.5M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
          </svg>
          Integrations ({count})
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 w-[calc(100vw-2rem)] md:w-72 max-w-80 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
              <button
                onClick={allSelected ? deselectAll : selectAll}
                className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center transition-colors ${
                  allSelected ? "bg-primary border-primary" : someSelected ? "bg-primary/50 border-primary" : "border-muted-foreground/40"
                }`}>
                  {(allSelected || someSelected) && (
                    <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      {allSelected ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                      )}
                    </svg>
                  )}
                </div>
                {allSelected ? "Deselect All" : "Select All"}
              </button>
              <span className="text-[11px] text-muted-foreground">
                {selectedIds.length === 0 ? `All (${integrations.length})` : `${selectedIds.length}/${integrations.length}`}
              </span>
            </div>

            <div className="max-h-[320px] overflow-y-auto">
              {integrations.map((opt) => {
                const isSelected = selectedIds.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggle(opt.value)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
                    }`}>
                      {isSelected && (
                        <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[12px] text-foreground">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {selectedIds.length === 0 && (
              <div className="px-3 py-2 border-t border-border bg-muted/20">
                <p className="text-[11px] text-muted-foreground">
                  None selected — AI has access to all team-allowed integrations.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedIds.map((value) => {
        const opt = integrations.find((i) => i.value === value);
        return opt ? (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-md bg-accent border border-border/60 px-2 py-0.5 text-[11px] font-medium text-foreground/80"
          >
            {opt.label}
            {!disabled && (
              <button
                onClick={() => toggle(value)}
                className="text-muted-foreground hover:text-foreground ml-0.5 transition-colors"
              >
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </span>
        ) : null;
      })}
    </div>
  );
}

/** Read-only display for existing chats */
export function IntegrationBadges({ integrationIds }: { integrationIds: string[] }) {
  const [integrations, setIntegrations] = useState<IntegrationOption[]>([]);

  useEffect(() => {
    if (integrationIds.length === 0) return;
    fetch("/api/integrations")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: IntegrationOption[]) =>
        setIntegrations(data.filter((i) => !CODE_SOURCE_INTEGRATIONS.has(i.value)))
      )
      .catch(() => {});
  }, [integrationIds]);

  if (integrationIds.length === 0) return null;
  const labels = integrations.filter((i) => integrationIds.includes(i.value));
  if (labels.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <svg className="h-3 w-3 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5h6m0 0v6m0-6L10.5 13.5M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
      {labels.map((opt) => (
        <span key={opt.value} className="inline-flex items-center gap-1 rounded-md bg-accent border border-border/60 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
          {opt.label}
        </span>
      ))}
    </div>
  );
}
