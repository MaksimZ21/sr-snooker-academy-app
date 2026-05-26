"use client";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CreateGroupDialog, EditGroupDialog } from "@/components/forms/group-dialog";
import type { Group, Student } from "@/lib/sheets/schemas";
import { studentFullName } from "@/lib/sheets/schemas";

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
    return (
      <Card>
        <CardContent className="p-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-semibold">
              {g.name}{" "}
              <span className="text-xs text-muted-foreground font-normal">
                ({g.student_ids.length} מתאמנים)
              </span>
            </div>
            <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-1">
              {g.student_ids.map((id) => (
                <span
                  key={id}
                  className="bg-muted px-1.5 py-0.5 rounded text-xs"
                >
                  {studentMap.get(id) ?? id}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <EditGroupDialog group={g} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteMut.mutate(g.id)}
              disabled={deleteMut.isPending}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </CardContent>
      </Card>
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
          <div key={college} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mt-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground px-1">{college}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {groups.map((g) => (
              <GroupCard key={g.id} g={g} />
            ))}
          </div>
        ))}

      {/* Standalone groups */}
      {standaloneGroups.length > 0 && collegeMap.size > 0 && (
        <div className="flex items-center gap-2 mt-1">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium text-muted-foreground px-1">קבוצות כלליות</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}
      {standaloneGroups.map((g) => (
        <GroupCard key={g.id} g={g} />
      ))}
    </div>
  );
}
