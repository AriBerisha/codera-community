"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface Project {
  id: string;
  name: string;
  pathWithNamespace: string;
  defaultBranch: string;
  indexStatus: string;
  source?: "gitlab" | "github";
}

interface Branch {
  name: string;
  isDefault: boolean;
}

interface ProjectSelection {
  projectId: string;
  branch: string;
}

interface ProjectSelectorProps {
  selectedIds: string[];
  branches: Record<string, string>;
  onChange: (ids: string[], branches: Record<string, string>) => void;
  disabled?: boolean;
}

export function ProjectSelector({ selectedIds, branches, onChange, disabled }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/gitlab/projects?local=true").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/admin/github/projects?local=true").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([gitlab, github]) => {
      const all = [...gitlab, ...github].filter(
        (p: Project & { included: boolean }) =>
          p.included && p.indexStatus === "INDEXED"
      );
      setProjects(all);
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggleProject(projectId: string, defaultBranch: string) {
    if (disabled) return;
    if (selectedIds.includes(projectId)) {
      const newIds = selectedIds.filter(id => id !== projectId);
      const newBranches = { ...branches };
      delete newBranches[projectId];
      onChange(newIds, newBranches);
    } else {
      onChange(
        [...selectedIds, projectId],
        { ...branches, [projectId]: branches[projectId] || defaultBranch }
      );
    }
  }

  function selectAll() {
    if (disabled) return;
    const allIds = projects.map(p => p.id);
    const allBranches: Record<string, string> = {};
    projects.forEach(p => {
      allBranches[p.id] = branches[p.id] || p.defaultBranch;
    });
    onChange(allIds, allBranches);
  }

  function deselectAll() {
    if (disabled) return;
    onChange([], {});
  }

  function setBranch(projectId: string, branchName: string) {
    if (disabled) return;
    onChange(selectedIds, { ...branches, [projectId]: branchName });
  }

  const allSelected = projects.length > 0 && selectedIds.length === projects.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < projects.length;

  if (projects.length === 0) {
    return (
      <div className="text-[12px] text-muted-foreground py-0.5">
        No indexed projects available
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap" ref={dropdownRef}>
      <div className="relative">
        <button
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[12px] font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          Repositories ({selectedIds.length})
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 w-[calc(100vw-2rem)] md:w-80 max-w-80 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            {/* Select All / Deselect All */}
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
                {selectedIds.length}/{projects.length}
              </span>
            </div>

            {/* Project list */}
            <div className="max-h-[320px] overflow-y-auto">
              {projects.map((project) => {
                const isSelected = selectedIds.includes(project.id);
                const currentBranch = branches[project.id] || project.defaultBranch;
                return (
                  <div key={project.id} className="border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors">
                      <button
                        onClick={() => toggleProject(project.id, project.defaultBranch)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
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
                        <SourceIcon source={project.source} />
                        <span className="text-[12px] text-foreground truncate">{project.pathWithNamespace}</span>
                      </button>
                      {isSelected && (
                        <BranchPicker
                          projectId={project.id}
                          currentBranch={currentBranch}
                          onSelect={(b) => setBranch(project.id, b)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected project badges */}
      {selectedIds.map((id) => {
        const project = projects.find((p) => p.id === id);
        const branchName = branches[id] || project?.defaultBranch;
        return project ? (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-md bg-accent border border-border/60 px-2 py-0.5 text-[11px] font-medium text-foreground/80"
          >
            <SourceIcon source={project.source} />
            {project.name}
            {branchName && (
              <span className="text-muted-foreground font-mono">:{branchName}</span>
            )}
            {!disabled && (
              <button
                onClick={() => toggleProject(id, project.defaultBranch)}
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
export function ProjectBadges({ projectIds, branches }: { projectIds: string[]; branches?: Record<string, string> }) {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (projectIds.length === 0) return;
    Promise.all([
      fetch("/api/admin/gitlab/projects?local=true").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/admin/github/projects?local=true").then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([gitlab, github]) => {
      const all = [...gitlab, ...github] as Array<Project & { included: boolean }>;
      setProjects(all.filter(p => projectIds.includes(p.id)));
    });
  }, [projectIds]);

  if (projects.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <svg className="h-3 w-3 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
      {projects.map(p => (
        <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-accent border border-border/60 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
          <SourceIcon source={(p as Project & { source?: string }).source as "gitlab" | "github" | undefined} />
          {p.name}
          {branches?.[p.id] && (
            <span className="text-muted-foreground font-mono">:{branches[p.id]}</span>
          )}
        </span>
      ))}
    </div>
  );
}

/** Branch picker dropdown per project */
function BranchPicker({
  projectId,
  currentBranch,
  onSelect,
}: {
  projectId: string;
  currentBranch: string;
  onSelect: (branch: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click or scroll
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleScroll() { setOpen(false); }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("scroll", handleScroll, true);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  // Load protected branches on first open
  const loadProtected = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/branches`);
      if (res.ok) setBranches(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
    setLoaded(true);
  }, [projectId, loaded]);

  function handleOpen() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 208; // w-52
      let left = rect.right - dropdownWidth;
      // Clamp to viewport
      left = Math.max(8, Math.min(left, window.innerWidth - dropdownWidth - 8));
      setPos({
        top: rect.bottom + 4,
        left,
      });
    }
    setOpen(!open);
    if (!open) loadProtected();
  }

  // Debounced search
  function handleSearch(value: string) {
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!value.trim()) {
      // Reset to protected branches
      setLoaded(false);
      loadProtected();
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/branches?search=${encodeURIComponent(value)}`);
        if (res.ok) setBranches(await res.json());
      } catch { /* ignore */ }
      setLoading(false);
    }, 300);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); handleOpen(); }}
        className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
      >
        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.07-9.07l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
        </svg>
        {currentBranch}
        <svg className="h-2 w-2" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-52 rounded-lg border border-border bg-card shadow-lg overflow-hidden"
          style={{ top: pos.top, left: pos.left }}
        >
          {/* Search */}
          <div className="p-1.5 border-b border-border">
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Search branches..."
              className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40"
              autoFocus
            />
          </div>

          {/* Branch list */}
          <div className="max-h-[200px] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-3">
                <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60 animate-spin" />
              </div>
            )}
            {!loading && branches.length === 0 && (
              <p className="text-[11px] text-muted-foreground px-3 py-2">
                {search ? "No branches found" : "No branches"}
              </p>
            )}
            {!loading && branches.map((b) => (
              <button
                key={b.name}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(b.name);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-accent transition-colors flex items-center gap-1.5 ${
                  b.name === currentBranch ? "text-primary" : "text-foreground"
                }`}
              >
                {b.name === currentBranch && (
                  <svg className="h-2.5 w-2.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
                <span className="truncate">{b.name}</span>
                {b.isDefault && (
                  <span className="text-[9px] font-sans text-muted-foreground ml-auto shrink-0">default</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Small icon indicating GitLab or GitHub source */
function SourceIcon({ source }: { source?: "gitlab" | "github" }) {
  if (source === "github") {
    return (
      <svg className="h-3 w-3 shrink-0 text-foreground/70" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.11.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    );
  }
  // Default to GitLab icon
  return (
    <svg className="h-3 w-3 shrink-0 text-[#FC6D26]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 00-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 00-.867 0L1.386 9.45.045 13.587a.924.924 0 00.331 1.023L12 23.054l11.624-8.443a.92.92 0 00.331-1.024" />
    </svg>
  );
}
