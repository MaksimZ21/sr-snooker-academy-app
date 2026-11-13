"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TABLE_SIZES, TABLE_SIZE_LABEL, type TableSize } from "@/lib/sheets/schemas";
import { useSkillLevels, SKILL_LEVELS_QUERY_KEY } from "@/components/use-skill-levels";

type Action =
  | { action: "add"; tableSize: TableSize; label: string }
  | { action: "rename"; id: string; label: string }
  | { action: "delete"; id: string }
  | { action: "move"; id: string; direction: "up" | "down" };

// The two level lists (12 ft and 9-10 ft), best at the top.
export function SettingsLevelsEditor() {
  const qc = useQueryClient();
  const { entries } = useSkillLevels();
  const [newLabel, setNewLabel] = useState<Record<TableSize, string>>({ "12": "", "9-10": "" });

  const mut = useMutation({
    mutationFn: async (body: Action) => {
      const r = await fetch("/api/settings/levels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) throw new Error(res?.error ?? "שגיאה בשמירה");
    },
    onSuccess: (_d, body) => {
      if (body.action === "add") setNewLabel((p) => ({ ...p, [body.tableSize]: "" }));
      qc.invalidateQueries({ queryKey: SKILL_LEVELS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["settings", "handicap"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "שגיאה בשמירה");
      qc.invalidateQueries({ queryKey: SKILL_LEVELS_QUERY_KEY });
    },
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {TABLE_SIZES.slice()
        .reverse()
        .map((size) => {
          const list = entries.filter((e) => e.table_size === size);
          return (
            <div key={size} className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-2">
              <p className="text-sm font-semibold">דרגות {TABLE_SIZE_LABEL[size]}</p>
              <p className="text-[11px] text-muted-foreground">מהחזקה ביותר (למעלה) לחלשה ביותר (למטה)</p>
              <div className="flex flex-col gap-1.5">
                {list.map((e, i) => (
                  <div key={e.id} className="flex items-center gap-1.5">
                    <Input
                      key={e.label}
                      defaultValue={e.label}
                      dir="ltr"
                      className="h-8 w-20 text-center font-semibold"
                      onBlur={(ev) => {
                        const v = ev.target.value.trim();
                        if (v && v !== e.label) mut.mutate({ action: "rename", id: e.id, label: v });
                        else ev.target.value = e.label;
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={i === 0 || mut.isPending}
                      onClick={() => mut.mutate({ action: "move", id: e.id, direction: "up" })}
                      aria-label="הזז למעלה"
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={i === list.length - 1 || mut.isPending}
                      onClick={() => mut.mutate({ action: "move", id: e.id, direction: "down" })}
                      aria-label="הזז למטה"
                    >
                      <ArrowDown size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      disabled={mut.isPending}
                      onClick={() => {
                        if (window.confirm(`למחוק את הדרגה ${e.label}?`)) mut.mutate({ action: "delete", id: e.id });
                      }}
                      aria-label="מחק"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <Input
                  value={newLabel[size]}
                  onChange={(ev) => setNewLabel((p) => ({ ...p, [size]: ev.target.value }))}
                  placeholder="דרגה חדשה"
                  dir="ltr"
                  className="h-8 w-28"
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" && newLabel[size].trim())
                      mut.mutate({ action: "add", tableSize: size, label: newLabel[size].trim() });
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={!newLabel[size].trim() || mut.isPending}
                  onClick={() => mut.mutate({ action: "add", tableSize: size, label: newLabel[size].trim() })}
                >
                  <Plus size={14} className="ml-1" />
                  הוסף
                </Button>
              </div>
            </div>
          );
        })}
    </div>
  );
}
