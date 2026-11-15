"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ChevronDown, ChevronUp, PauseCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WebhookLog {
  id: number;
  route: string;
  event_type: string | null;
  params: Record<string, unknown>;
  status: string;
  result: unknown;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  ok:        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  error:     "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  not_found: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  invalid:   "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  skipped:   "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const ROUTE_LABELS: Record<string, string> = {
  crm:        "student",
  attendance: "attendance",
  training:   "training",
};

export function WebhookLogsViewer() {
  const [routeFilter, setRouteFilter]   = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const qc = useQueryClient();

  const pauseQ = useQuery({
    queryKey: ["crm-paused"],
    queryFn: async () => {
      const r = await fetch("/api/admin/crm-pause");
      return (await r.json()) as { paused: boolean };
    },
  });

  const toggleMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/crm-pause", { method: "POST" });
      return (await r.json()) as { paused: boolean };
    },
    onSuccess: (result) => {
      qc.setQueryData(["crm-paused"], result);
      toast.success(result.paused ? "CRM מושהה — הנתונים לא יישמרו" : "CRM פעיל מחדש");
    },
    onError: () => toast.error("שגיאה בשינוי הסטטוס"),
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["webhook-logs", routeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "200" });
      if (routeFilter)  params.set("route",  routeFilter);
      if (statusFilter) params.set("status", statusFilter);
      const r = await fetch(`/api/admin/webhook-logs?${params}`);
      return (await r.json()) as { logs: WebhookLog[] };
    },
    refetchInterval: 30_000,
  });

  const logs = data?.logs ?? [];

  function toggle(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const paused = pauseQ.data?.paused ?? false;

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4">

      {/* CRM pause toggle */}
      <div className={cn(
        "flex items-center justify-between rounded-xl border px-4 py-3 transition-colors",
        paused
          ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
          : "border-border/60 bg-card",
      )}>
        <div className="flex items-center gap-2.5">
          {paused
            ? <PauseCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
            : <PlayCircle size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />}
          <div>
            <p className="text-sm font-medium">
              {paused ? "CRM מושהה" : "CRM פעיל"}
            </p>
            <p className="text-xs text-muted-foreground">
              {paused
                ? "הנתונים מה-CRM מגיעים אך לא נשמרים"
                : "כל הנתונים מה-CRM נשמרים רגיל"}
            </p>
          </div>
        </div>
        <Button
          variant={paused ? "default" : "outline"}
          size="sm"
          onClick={() => toggleMut.mutate()}
          disabled={toggleMut.isPending || pauseQ.isLoading}
        >
          {paused ? "המשך קבלה" : "השהה CRM"}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {/* Route filter */}
          <div className="flex gap-1">
            {["", "crm", "attendance", "training"].map((r) => (
              <button
                key={r}
                onClick={() => setRouteFilter(r)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  routeFilter === r
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border/60 hover:border-primary/50",
                )}
              >
                {r === "" ? "הכל" : ROUTE_LABELS[r] ?? r}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex gap-1">
            {["", "ok", "not_found", "invalid", "error", "skipped"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border/60 hover:border-primary/50",
                )}
              >
                {s === "" ? "כל סטטוסים" : s}
              </button>
            ))}
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          רענן
        </Button>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">{logs.length} רשומות</p>

      {/* Table */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-border/60 p-12 text-center text-sm text-muted-foreground">
          אין רשומות עדיין
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 overflow-hidden">
          {logs.map((log, idx) => {
            const expanded = expandedId === log.id;
            return (
              <div key={log.id} className={cn("border-b border-border/40 last:border-0", idx % 2 === 0 ? "bg-card" : "bg-muted/20")}>
                {/* Row */}
                <button
                  type="button"
                  onClick={() => toggle(log.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-muted/30 transition-colors"
                >
                  {/* Status pill */}
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0", STATUS_STYLES[log.status] ?? STATUS_STYLES.skipped)}>
                    {log.status}
                  </span>

                  {/* Route + event */}
                  <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">{ROUTE_LABELS[log.route] ?? log.route}</span>
                  <span className="text-xs font-medium flex-1 text-right truncate">{log.event_type ?? "—"}</span>

                  {/* Name/phone preview */}
                  <span className="text-xs text-muted-foreground truncate max-w-[160px] hidden sm:block">
                    {[log.params.name, log.params.first_name, log.params.last_name, log.params.phone].filter(Boolean).join(" ") || "—"}
                  </span>

                  {/* Time */}
                  <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                    {new Date(log.created_at).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>

                  {expanded ? <ChevronUp size={14} className="shrink-0 text-muted-foreground" /> : <ChevronDown size={14} className="shrink-0 text-muted-foreground" />}
                </button>

                {/* Expanded detail */}
                {expanded && (
                  <div className="px-4 pb-4 flex flex-col gap-3 text-xs" dir="ltr">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="font-semibold text-muted-foreground mb-1 uppercase tracking-wide text-[10px]">Params</p>
                        <pre className="bg-muted/40 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap break-all">
                          {JSON.stringify(log.params, null, 2)}
                        </pre>
                      </div>
                      {log.result !== null && (
                        <div>
                          <p className="font-semibold text-muted-foreground mb-1 uppercase tracking-wide text-[10px]">Result</p>
                          <pre className="bg-muted/40 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap break-all">
                            {JSON.stringify(log.result, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
