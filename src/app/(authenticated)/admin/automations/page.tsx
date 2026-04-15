"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────

interface ScheduleConfig {
  intervalMinutes?: number;
  timeOfDay?: string; // "HH:MM"
  daysOfWeek?: number[]; // 0=Sun..6=Sat
}

interface Automation {
  id: string;
  title: string;
  instructions: string;
  cronExpression: string;
  scheduleType: string;
  scheduleConfig: ScheduleConfig | null;
  dataSources: string[];
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
  user: { name: string | null; email: string };
  _count: { runs: number };
}

interface AutomationRun {
  id: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  response: string | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface AutomationDetail extends Automation {
  runs: AutomationRun[];
}

// ─── Schedule helpers ────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildCronExpression(
  type: string,
  config: ScheduleConfig
): string {
  switch (type) {
    case "interval": {
      const mins = config.intervalMinutes ?? 60;
      if (mins < 60) return `*/${mins} * * * *`;
      const hours = Math.floor(mins / 60);
      return `0 */${hours} * * *`;
    }
    case "daily": {
      const [h, m] = (config.timeOfDay ?? "09:00").split(":").map(Number);
      return `${m} ${h} * * *`;
    }
    case "weekly": {
      const [h, m] = (config.timeOfDay ?? "09:00").split(":").map(Number);
      const days = config.daysOfWeek?.length
        ? config.daysOfWeek.join(",")
        : "1"; // default Monday
      return `${m} ${h} * * ${days}`;
    }
    case "custom":
      return "0 * * * *"; // user edits raw cron
    default:
      return "0 * * * *";
  }
}

function describeSchedule(type: string, config: ScheduleConfig | null, cron: string): string {
  if (!config) return cron;
  switch (type) {
    case "interval": {
      const mins = config.intervalMinutes ?? 60;
      if (mins < 60) return `Every ${mins} min`;
      if (mins < 1440) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `Every ${h}h ${m}m` : `Every ${h}h`;
      }
      const d = Math.floor(mins / 1440);
      return `Every ${d} day${d > 1 ? "s" : ""}`;
    }
    case "daily":
      return `Daily at ${config.timeOfDay ?? "09:00"}`;
    case "weekly": {
      const days = config.daysOfWeek?.map((d) => DAY_LABELS[d]).join(", ") ?? "Mon";
      return `${days} at ${config.timeOfDay ?? "09:00"}`;
    }
    case "custom":
      return cron;
    default:
      return cron;
  }
}

interface IntegrationOption {
  value: string;
  label: string;
}

// ─── Component ───────────────────────────────────────────

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableIntegrations, setAvailableIntegrations] = useState<IntegrationOption[]>([]);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [scheduleType, setScheduleType] = useState("interval");
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [customCron, setCustomCron] = useState("0 * * * *");
  const [dataSources, setDataSources] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Detail / run history
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AutomationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchAutomations = useCallback(async () => {
    try {
      const res = await fetch("/api/automations");
      if (res.ok) setAutomations(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
    fetch("/api/integrations")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAvailableIntegrations)
      .catch(() => {});
  }, [fetchAutomations]);

  async function fetchDetail(id: string) {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/automations/${id}`);
      if (res.ok) setDetail(await res.json());
    } catch {
      toast.error("Failed to load automation details");
    } finally {
      setLoadingDetail(false);
    }
  }

  function resetForm() {
    setTitle("");
    setInstructions("");
    setScheduleType("interval");
    setIntervalMinutes("60");
    setTimeOfDay("09:00");
    setDaysOfWeek([1, 2, 3, 4, 5]);
    setCustomCron("0 * * * *");
    setDataSources([]);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(auto: Automation) {
    setEditingId(auto.id);
    setTitle(auto.title);
    setInstructions(auto.instructions);
    setScheduleType(auto.scheduleType);
    const cfg = auto.scheduleConfig ?? {};
    setIntervalMinutes(String(cfg.intervalMinutes ?? 60));
    setTimeOfDay(cfg.timeOfDay ?? "09:00");
    setDaysOfWeek(cfg.daysOfWeek ?? [1, 2, 3, 4, 5]);
    setCustomCron(auto.cronExpression);
    setDataSources(auto.dataSources ?? []);
    setShowForm(true);
    setSelectedId(null);
  }

  function toggleDataSource(source: string) {
    setDataSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  }

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const scheduleConfig: ScheduleConfig = {};
    let cronExpression: string;

    switch (scheduleType) {
      case "interval":
        scheduleConfig.intervalMinutes = parseInt(intervalMinutes) || 60;
        cronExpression = buildCronExpression("interval", scheduleConfig);
        break;
      case "daily":
        scheduleConfig.timeOfDay = timeOfDay;
        cronExpression = buildCronExpression("daily", scheduleConfig);
        break;
      case "weekly":
        scheduleConfig.timeOfDay = timeOfDay;
        scheduleConfig.daysOfWeek = daysOfWeek;
        cronExpression = buildCronExpression("weekly", scheduleConfig);
        break;
      default:
        cronExpression = customCron;
    }

    try {
      const body = {
        title,
        instructions,
        cronExpression,
        scheduleType,
        scheduleConfig,
        dataSources,
      };
      const res = editingId
        ? await fetch(`/api/automations/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/automations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
        return;
      }

      toast.success(editingId ? "Automation updated" : "Automation created");
      resetForm();
      fetchAutomations();
    } catch {
      toast.error("Failed to save automation");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    try {
      await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      setAutomations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, enabled } : a))
      );
    } catch {
      toast.error("Failed to toggle automation");
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/automations/${id}`, { method: "DELETE" });
      setAutomations((prev) => prev.filter((a) => a.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      toast.success("Automation deleted");
    } catch {
      toast.error("Failed to delete automation");
    }
  }

  async function handleTrigger(id: string) {
    try {
      const res = await fetch(`/api/automations/${id}/trigger`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Trigger failed");
        return;
      }
      toast.success("Automation triggered — running in background");

      const interval = setInterval(async () => {
        const r = await fetch(`/api/automations/${id}`);
        if (r.ok) {
          const data: AutomationDetail = await r.json();
          const latestRun = data.runs[0];
          if (latestRun && latestRun.status !== "RUNNING") {
            clearInterval(interval);
            fetchAutomations();
            if (selectedId === id) setDetail(data);
            if (latestRun.status === "SUCCESS") {
              toast.success("Automation completed successfully");
            } else {
              toast.error("Automation failed: " + (latestRun.error || "Unknown error"));
            }
          }
        }
      }, 3000);

      setTimeout(() => clearInterval(interval), 300000);
    } catch {
      toast.error("Failed to trigger automation");
    }
  }

  function viewRuns(id: string) {
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
    } else {
      setSelectedId(id);
      fetchDetail(id);
    }
  }

  const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
    RUNNING: "default",
    SUCCESS: "default",
    FAILED: "destructive",
  };

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automations</h1>
          <p className="text-muted-foreground mt-1">
            Schedule AI tasks to run automatically on a recurring schedule.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>New Automation</Button>
        )}
      </div>

      {/* ─── Create / Edit Form ─── */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Automation" : "New Automation"}</CardTitle>
            <CardDescription>
              Define the AI instructions and when they should run.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="auto-title">Title</Label>
                <Input
                  id="auto-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Daily Security Audit"
                  required
                />
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <Label htmlFor="auto-instructions">Instructions</Label>
                <textarea
                  id="auto-instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Enter the instructions for the AI to follow each time this automation runs..."
                  required
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Schedule */}
              <div className="space-y-3">
                <Label>Schedule</Label>

                {/* Schedule type tabs */}
                <div className="flex gap-1 rounded-lg bg-muted p-1">
                  {(
                    [
                      ["interval", "Repeat Interval"],
                      ["daily", "Daily"],
                      ["weekly", "Weekly"],
                      ["custom", "Custom Cron"],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setScheduleType(val)}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        scheduleType === val
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Interval config */}
                {scheduleType === "interval" && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="interval-val" className="text-xs text-muted-foreground">
                        Every
                      </Label>
                      <Input
                        id="interval-val"
                        type="number"
                        min={1}
                        value={intervalMinutes}
                        onChange={(e) => setIntervalMinutes(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Unit</Label>
                      <div className="flex gap-1">
                        {(
                          [
                            [1, "min"],
                            [60, "hr"],
                            [1440, "day"],
                          ] as const
                        ).map(([mult, label]) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              const v = parseInt(intervalMinutes) || 60;
                              if (mult === 60 && v < 60) setIntervalMinutes("60");
                              else if (mult === 1440 && v < 1440) setIntervalMinutes("1440");
                            }}
                            className={`flex-1 rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
                              (() => {
                                const v = parseInt(intervalMinutes) || 60;
                                return (
                                  (mult === 1 && v < 60) ||
                                  (mult === 60 && v >= 60 && v < 1440) ||
                                  (mult === 1440 && v >= 1440)
                                );
                              })()
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-transparent text-muted-foreground border-input hover:border-foreground/30"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-end">
                      <p className="text-xs text-muted-foreground pb-2.5">
                        {describeSchedule("interval", { intervalMinutes: parseInt(intervalMinutes) || 60 }, "")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Daily config */}
                {scheduleType === "daily" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="daily-time" className="text-xs text-muted-foreground">
                        Time of Day
                      </Label>
                      <Input
                        id="daily-time"
                        type="time"
                        value={timeOfDay}
                        onChange={(e) => setTimeOfDay(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <p className="text-xs text-muted-foreground pb-2.5">
                        Runs every day at {timeOfDay}
                      </p>
                    </div>
                  </div>
                )}

                {/* Weekly config */}
                {scheduleType === "weekly" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Days of Week</Label>
                      <div className="flex gap-1.5">
                        {DAY_LABELS.map((label, idx) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => toggleDay(idx)}
                            className={`h-9 w-9 rounded-full text-xs font-medium transition-colors ${
                              daysOfWeek.includes(idx)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {label.charAt(0)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="weekly-time" className="text-xs text-muted-foreground">
                          Time of Day
                        </Label>
                        <Input
                          id="weekly-time"
                          type="time"
                          value={timeOfDay}
                          onChange={(e) => setTimeOfDay(e.target.value)}
                        />
                      </div>
                      <div className="flex items-end">
                        <p className="text-xs text-muted-foreground pb-2.5">
                          {describeSchedule("weekly", { timeOfDay, daysOfWeek }, "")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Custom cron */}
                {scheduleType === "custom" && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-cron" className="text-xs text-muted-foreground">
                      Cron Expression (min hour dom month dow)
                    </Label>
                    <Input
                      id="custom-cron"
                      value={customCron}
                      onChange={(e) => setCustomCron(e.target.value)}
                      placeholder="*/30 * * * *"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Examples: <code className="bg-muted px-1 rounded">*/15 * * * *</code> every 15 min,{" "}
                      <code className="bg-muted px-1 rounded">0 9 * * 1-5</code> weekdays at 9am,{" "}
                      <code className="bg-muted px-1 rounded">30 8,17 * * *</code> 8:30am & 5:30pm
                    </p>
                  </div>
                )}
              </div>

              {/* Integrations */}
              {availableIntegrations.length > 0 && (
                <div className="space-y-3">
                  <Label>Integrations (optional)</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Select which connected data sources the AI should have access to when running this automation.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableIntegrations.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleDataSource(opt.value)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          dataSources.includes(opt.value)
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-input bg-transparent text-muted-foreground hover:text-foreground hover:border-foreground/30"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            dataSources.includes(opt.value) ? "bg-[#68c2ff]" : "bg-[#7d8590]"
                          }`}
                        />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update" : "Create Automation"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── Automations List ─── */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Automations</CardTitle>
          <CardDescription>
            {automations.length === 0 && !loading
              ? "No automations yet. Create one to get started."
              : "Manage your scheduled AI tasks. Click a row to view run history."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : automations.length === 0 ? null : (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Automation</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {automations.map((auto) => (
                    <Fragment key={auto.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => viewRuns(auto.id)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{auto.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {auto.instructions}
                            </p>
                            {auto.dataSources.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {auto.dataSources.map((ds) => {
                                  const opt = availableIntegrations.find((o) => o.value === ds);
                                  return (
                                    <span
                                      key={ds}
                                      className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                    >
                                      <span className="h-1.5 w-1.5 rounded-full bg-[#68c2ff]" />
                                      {opt?.label ?? ds}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="text-xs">
                            {describeSchedule(auto.scheduleType, auto.scheduleConfig, auto.cronExpression)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={auto.enabled ? "default" : "secondary"}>
                            {auto.enabled ? "Active" : "Paused"}
                          </Badge>
                        </TableCell>
                        <TableCell>{auto._count.runs}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {auto.lastRunAt
                            ? new Date(auto.lastRunAt).toLocaleString()
                            : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="outline" size="sm" onClick={() => handleTrigger(auto.id)}>
                              Run Now
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleToggle(auto.id, !auto.enabled)}>
                              {auto.enabled ? "Pause" : "Enable"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => startEdit(auto)}>
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(auto.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded run history */}
                      {selectedId === auto.id && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30 p-0">
                            <div className="p-4">
                              <h4 className="text-sm font-semibold mb-3">Run History</h4>
                              {loadingDetail ? (
                                <p className="text-sm text-muted-foreground">Loading...</p>
                              ) : !detail || detail.runs.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  No runs yet. Click &quot;Run Now&quot; to trigger this automation.
                                </p>
                              ) : (
                                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                  {detail.runs.map((run) => (
                                    <div key={run.id} className="rounded-lg border bg-card p-3">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge variant={statusVariant[run.status] || "secondary"}>
                                          {run.status}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(run.startedAt).toLocaleString()}
                                        </span>
                                        {run.completedAt && (
                                          <span className="text-xs text-muted-foreground">
                                            ({Math.round(
                                              (new Date(run.completedAt).getTime() -
                                                new Date(run.startedAt).getTime()) /
                                                1000
                                            )}s)
                                          </span>
                                        )}
                                      </div>
                                      {run.response && (
                                        <pre className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                                          {run.response}
                                        </pre>
                                      )}
                                      {run.error && (
                                        <pre className="text-xs bg-destructive/10 text-destructive rounded p-2 whitespace-pre-wrap">
                                          {run.error}
                                        </pre>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
