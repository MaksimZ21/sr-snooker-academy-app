"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSkillLevels } from "@/components/use-skill-levels";
import type { HandicapDistrict } from "@/lib/sheets/handicap";

const QUERY_KEY = ["settings", "handicap"];

type Action =
  | { action: "add"; name: string }
  | { action: "rename"; id: string; name: string }
  | { action: "delete"; id: string }
  | { action: "set"; id: string; level: string; points: number | null };

// The handicap ("פור") table: one card per district, a number per 12 ft
// level. Each field saves on its own when you leave it.
export function SettingsHandicapTable() {
  const qc = useQueryClient();
  const { lists } = useSkillLevels();
  const [newName, setNewName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/settings/handicap");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { districts: HandicapDistrict[] };
    },
  });

  const mut = useMutation({
    mutationFn: async (body: Action) => {
      const r = await fetch("/api/settings/handicap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) throw new Error(res?.error ?? "שגיאה בשמירה");
    },
    onSuccess: (_d, body) => {
      if (body.action === "add") setNewName("");
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "שגיאה בשמירה");
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  const districts = data?.districts ?? [];
  const levels = lists["12"];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        נקודות לכל פריים לפי דרגה (12 פיט). כששני שחקנים משחקים, החלש מקבל את ההפרש — למשל B (4) נגד C (7): C מקבל
        3 נקודות. שדה ריק = הדרגה לא קיימת במחוז.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {districts.map((d) => (
          <div key={d.id} className="rounded-2xl border border-border/60 bg-card p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Input
                key={d.name}
                defaultValue={d.name}
                className="h-8 font-semibold"
                onBlur={(ev) => {
                  const v = ev.target.value.trim();
                  if (v && v !== d.name) mut.mutate({ action: "rename", id: d.id, name: v });
                  else ev.target.value = d.name;
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-destructive"
                disabled={mut.isPending}
                onClick={() => {
                  if (window.confirm(`למחוק את המחוז ${d.name} מטבלת הפור?`)) mut.mutate({ action: "delete", id: d.id });
                }}
                aria-label="מחק מחוז"
              >
                <Trash2 size={14} />
              </Button>
            </div>
            <div className="flex flex-col gap-1">
              {levels.map((level) => {
                const current = d.values[level];
                return (
                  <div key={level} className="flex items-center justify-between gap-2">
                    <span className="w-10 text-center text-sm font-semibold" dir="ltr">
                      {level}
                    </span>
                    <Input
                      key={`${level}:${current ?? ""}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      defaultValue={current ?? ""}
                      className="h-7 w-20 text-center tabular-nums"
                      onBlur={(ev) => {
                        const raw = ev.target.value.trim();
                        const points = raw === "" ? null : Number(raw);
                        if (points !== null && (!Number.isFinite(points) || points < 0)) {
                          ev.target.value = current === undefined ? "" : String(current);
                          return;
                        }
                        if ((points ?? undefined) === current) return;
                        mut.mutate({ action: "set", id: d.id, level, points });
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={(ev) => setNewName(ev.target.value)}
          placeholder="מחוז חדש"
          className="h-9 w-48"
          onKeyDown={(ev) => {
            if (ev.key === "Enter" && newName.trim()) mut.mutate({ action: "add", name: newName.trim() });
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!newName.trim() || mut.isPending}
          onClick={() => mut.mutate({ action: "add", name: newName.trim() })}
        >
          <Plus size={14} className="ml-1" />
          הוסף מחוז
        </Button>
      </div>
    </div>
  );
}
