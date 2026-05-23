"use client";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AddStudentDialog } from "@/components/forms/add-student-dialog";
import { StudentHistoryDialog } from "@/components/student-history-dialog";
import { History, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Student } from "@/lib/sheets/schemas";
import { studentFullName } from "@/lib/sheets/schemas";

export function StudentsList() {
  const [selected, setSelected] = useState<Student | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const queryClient = useQueryClient();

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const r = await fetch(`/api/students/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      await queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("המתאמן נמחק");
    } catch {
      toast.error("שגיאה במחיקה");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const r = await fetch("/api/students");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { students: Student[] };
    },
    staleTime: 5 * 60_000,
  });

  const colleges = useMemo(() => {
    const names = (data?.students ?? [])
      .map((s) => s.college_name)
      .filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.students ?? []).filter((s) => {
      if (statusFilter === "active" && !s.active) return false;
      if (statusFilter === "inactive" && s.active) return false;
      if (collegeFilter !== "all" && s.college_name !== collegeFilter) return false;
      if (!q) return true;
      return (
        studentFullName(s).toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    });
  }, [data, search, statusFilter, collegeFilter]);

  const hasFilters = search || statusFilter !== "all" || collegeFilter !== "all";

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">ניהול רשימת המתאמנים</p>
        <AddStudentDialog />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="חיפוש לפי שם, טלפון, מייל..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-8"
            dir="rtl"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="inactive">לא פעיל</SelectItem>
          </SelectContent>
        </Select>
        {colleges.length > 0 && (
          <Select value={collegeFilter} onValueChange={(v) => setCollegeFilter(v ?? "all")}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="כל המכללות" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל המכללות</SelectItem>
              {colleges.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {hasFilters && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => { setSearch(""); setStatusFilter("all"); setCollegeFilter("all"); }}
            title="נקה סינון"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} מתאמנים{hasFilters ? ` (מתוך ${data?.students.length ?? 0})` : ""}
      </p>

      {filtered.map((s) => (
        <Card key={s.id}>
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold">
                {studentFullName(s)}{" "}
                <span className="text-xs text-muted-foreground">({s.id})</span>
              </div>
              {s.email && (
                <div className="text-sm text-muted-foreground truncate">{s.email}</div>
              )}
              {s.phone && (
                <div className="text-sm text-muted-foreground">{s.phone}</div>
              )}
              {s.college_name && (
                <div className="text-sm text-muted-foreground">{s.college_name}</div>
              )}
              {s.general_notes && (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                  {s.general_notes}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Badge variant={s.active ? "default" : "secondary"}>
                {s.active ? "פעיל" : "לא פעיל"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setSelected(s)}
              >
                <History className="h-3.5 w-3.5 ml-1" />
                נוכחות
              </Button>
              {confirmDelete === s.id ? (
                <div className="flex gap-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={deleting}
                    onClick={() => handleDelete(s.id)}
                  >
                    בטוח?
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setConfirmDelete(null)}
                  >
                    ביטול
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 ml-1" />
                  מחק
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">לא נמצאו מתאמנים</p>
      )}

      {selected && (
        <StudentHistoryDialog
          studentId={selected.id}
          studentName={studentFullName(selected)}
          open={true}
          onOpenChange={(v) => { if (!v) setSelected(null); }}
        />
      )}
    </div>
  );
}
