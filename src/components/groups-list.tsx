"use client";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Trash2, User, Clock } from "lucide-react";
import { toast } from "sonner";
import { CreateGroupDialog, EditGroupDialog } from "@/components/forms/group-dialog";
import type { Group, Student } from "@/lib/sheets/schemas";
import { studentFullName } from "@/lib/sheets/schemas";

type Coach = { email: string; name: string; active: boolean };

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function GroupsList() {
  const qc = useQueryClient();

  const groupsQ = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const r = await fetch("/api/groups");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { groups: Group[] };
    },
    staleTime: 60_000,
  });

  const studentsQ = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const r = await fetch("/api/students");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { students: Student[] };
    },
    staleTime: 5 * 60_000,
  });

  const coachesQ = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { coaches: Coach[] };
    },
    staleTime: 5 * 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/groups/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("קבוצה נמחקה");
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: () => toast.error("שגיאה במחיקה"),
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/sync-college-groups", { method: "POST" });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { synced: number };
    },
    onSuccess: (data) => {
      toast.success(`סונכרנו ${data.synced} מתאמנים לקבוצות מכללה`);
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: () => toast.error("שגיאה בסנכרון"),
  });

  const studentMap = new Map(
    (studentsQ.data?.students ?? []).map((s) => [s.id, studentFullName(s)]),
  );

  const coachMap = new Map(
    (coachesQ.data?.coaches ?? []).map((c) => [c.email, c.name]),
  );

  const { standaloneGroups, collegeMap } = useMemo(() => {
    const groups = groupsQ.data?.groups ?? [];
    const standaloneGroups: Group[] = [];
    const collegeMap = new Map<string, Group[]>();
    for (const g of groups) {
      if (g.college_name) {
        if (!collegeMap.has(g.college_name)) collegeMap.set(g.college_name, []);
        collegeMap.get(g.college_name)!.push(g);
      } else {
        standaloneGroups.push(g);
      }
    }
    return { standaloneGroups, collegeMap };
  }, [groupsQ.data]);

  if (groupsQ.isLoading) {
    return (
      <div className="p-4 flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const totalGroups = (groupsQ.data?.groups ?? []).length;

  function GroupCard({ g }: { g: Group }) {
    const coachName = g.coach_email ? (coachMap.get(g.coach_email) ?? g.coach_email) : null;
    const names = g.student_ids.map((id) => studentMap.get(id) ?? id);
    const shown = names.slice(0, 8);
    return (
      <div className="rounded-[18px] border bg-card p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[15px] font-extrabold leading-snug">{g.name}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {g.start_time && (
                <span className="flex items-center gap-1 rounded-md bg-sidebar text-white px-2 py-0.5 font-display text-[11px] font-bold tabular-nums">
                  <Clock size={11} />
                  {g.start_time}–{addMinutes(g.start_time, 90)}
                </span>
              )}
              {coachName && (
                <span className="flex items-center gap-1 rounded-md bg-muted text-muted-foreground px-2 py-0.5 font-display text-[11px] font-bold">
                  <User size={11} />
                  {coachName}
                </span>
              )}
            </div>
          </div>
          <div className="text-center shrink-0">
            <p className="bc-num text-3xl leading-none">{g.student_ids.length}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">מתאמנים</p>
          </div>
        </div>
        {names.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {shown.map((n, i) => (
              <span key={`${n}-${i}`} className="bg-muted/70 px-2 py-0.5 rounded-md text-xs">
                {n}
              </span>
            ))}
            {names.length > shown.length && (
              <span className="px-2 py-0.5 rounded-md text-xs font-bold text-muted-foreground">+{names.length - shown.length}</span>
            )}
          </div>
        )}
        <div className="flex items-center justify-end gap-1 border-t pt-2 -mb-1">
          <EditGroupDialog group={g} />
          <Button
            variant="ghost"
            size="icon"
            title="מחיקת קבוצה"
            onClick={() => {
              if (window.confirm(`למחוק את הקבוצה ${g.name}?`)) deleteMut.mutate(g.id);
            }}
            disabled={deleteMut.isPending}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          קבוצות מתאמנים לשיבוץ מהיר לסשן
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
            title="צור/עדכן קבוצות אוטומטית לפי מכללה"
          >
            <RefreshCw className={`h-3.5 w-3.5 ml-1.5 ${syncMut.isPending ? "animate-spin" : ""}`} />
            סנכרן מכללות
          </Button>
          <CreateGroupDialog />
        </div>
      </div>

      {totalGroups === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          אין קבוצות עדיין
        </p>
      )}

      {/* College sections */}
      {Array.from(collegeMap.entries())
        .sort(([a], [b]) => a.localeCompare(b, "he"))
        .map(([college, groups]) => (
          <section key={college} className="flex flex-col gap-2.5 mt-2">
            <h2 className="bc-kicker text-sm text-primary">
              {college}
              <span className="text-muted-foreground font-medium">· {groups.length} קבוצות</span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {groups.map((g) => (
                <GroupCard key={g.id} g={g} />
              ))}
            </div>
          </section>
        ))}

      {/* Standalone groups */}
      {standaloneGroups.length > 0 && collegeMap.size > 0 && (
        <h2 className="bc-kicker text-sm text-primary mt-2">קבוצות כלליות</h2>
      )}
      {standaloneGroups.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {standaloneGroups.map((g) => (
            <GroupCard key={g.id} g={g} />
          ))}
        </div>
      )}
    </div>
  );
}
