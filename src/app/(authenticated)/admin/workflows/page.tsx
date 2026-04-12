"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const STEP_TYPES = ["PLANNING", "PROGRAMMING", "COMMIT"] as const;
type StepType = (typeof STEP_TYPES)[number];

interface WorkflowStep {
  id?: string;
  name: string;
  type: StepType;
  order: number;
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  steps: WorkflowStep[];
  _count: { executions: number };
  createdAt: string;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<Array<{ name: string; type: StepType }>>([
    { name: "Planning", type: "PLANNING" },
    { name: "Programming", type: "PROGRAMMING" },
    { name: "Commit", type: "COMMIT" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  async function fetchWorkflows() {
    try {
      const res = await fetch("/api/admin/workflows");
      if (res.ok) setWorkflows(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWorkflows();
  }, []);

  function resetForm() {
    setName("");
    setDescription("");
    setSteps([
      { name: "Planning", type: "PLANNING" },
      { name: "Programming", type: "PROGRAMMING" },
      { name: "Commit", type: "COMMIT" },
    ]);
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(w: Workflow) {
    setEditingId(w.id);
    setName(w.name);
    setDescription(w.description || "");
    setSteps(w.steps.map((s) => ({ name: s.name, type: s.type as StepType })));
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || steps.length === 0) return;

    setSubmitting(true);
    try {
      const body = { name, description: description || null, steps };
      const url = editingId
        ? `/api/admin/workflows/${editingId}`
        : "/api/admin/workflows";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save workflow");
        return;
      }
      toast.success(editingId ? "Workflow updated" : "Workflow created");
      setDialogOpen(false);
      resetForm();
      fetchWorkflows();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, wName: string) {
    if (!confirm(`Delete workflow "${wName}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/workflows/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to delete workflow");
        return;
      }
      toast.success("Workflow deleted");
      fetchWorkflows();
    } catch {
      toast.error("An unexpected error occurred");
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/admin/workflows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (res.ok) {
      toast.success(isActive ? "Workflow deactivated" : "Workflow activated");
      fetchWorkflows();
    }
  }

  async function setDefault(id: string) {
    const res = await fetch(`/api/admin/workflows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    if (res.ok) {
      toast.success("Default workflow updated");
      fetchWorkflows();
    }
  }

  function addStep() {
    setSteps([...steps, { name: "", type: "PLANNING" }]);
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function updateStep(
    index: number,
    field: "name" | "type",
    value: string
  ) {
    setSteps(
      steps.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      )
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
          <p className="text-muted-foreground mt-1">
            Configure AI workflow pipelines with customizable steps.
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) resetForm();
          }}
        >
          <DialogTrigger
            onClick={openCreate}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            Create Workflow
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Workflow" : "Create Workflow"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div>
                <Label htmlFor="wf-name">Name</Label>
                <Input
                  id="wf-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Code Change"
                />
              </div>
              <div>
                <Label htmlFor="wf-desc">Description</Label>
                <Input
                  id="wf-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Steps</Label>
                  <button
                    type="button"
                    onClick={addStep}
                    className="text-[12px] font-medium text-primary hover:underline"
                  >
                    + Add Step
                  </button>
                </div>
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2"
                    >
                      <span className="text-[11px] font-mono text-muted-foreground w-5 text-center shrink-0">
                        {i + 1}
                      </span>
                      <Input
                        value={step.name}
                        onChange={(e) => updateStep(i, "name", e.target.value)}
                        placeholder="Step name"
                        className="flex-1 h-8 text-[13px]"
                        required
                      />
                      <Select
                        value={step.type}
                        onValueChange={(v) => v && updateStep(i, "type", v)}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-[13px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STEP_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t.charAt(0) + t.slice(1).toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(i)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting
                  ? "Saving..."
                  : editingId
                    ? "Update Workflow"
                    : "Create Workflow"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading workflows...</p>
      ) : workflows.length === 0 ? (
        <div className="flex items-center justify-center h-[300px] rounded-lg border border-dashed border-border">
          <div className="text-center">
            <p className="text-[14px] font-medium text-foreground">
              No workflows yet
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">
              Create your first workflow to get started.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Executions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium text-foreground">
                        {w.name}
                      </span>
                      {w.description && (
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          {w.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {w.steps.map((s, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <svg
                              className="h-3 w-3 text-muted-foreground/40"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8.25 4.5l7.5 7.5-7.5 7.5"
                              />
                            </svg>
                          )}
                          <Badge variant="secondary" className="text-[11px]">
                            {s.name}
                          </Badge>
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-[13px] text-muted-foreground">
                      {w._count.executions}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={w.isActive ? "default" : "secondary"}
                      >
                        {w.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {w.isDefault && (
                        <Badge variant="outline" className="text-[11px]">
                          Default
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(w)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(w.id, w.isActive)}
                      >
                        {w.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      {!w.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefault(w.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(w.id, w.name)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
