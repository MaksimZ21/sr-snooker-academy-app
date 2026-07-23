"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AddStudentDialog } from "@/components/forms/add-student-dialog";
import { EditStudentDialog } from "@/components/forms/edit-student-dialog";
import { StudentHistoryDialog } from "@/components/student-history-dialog";
import { History, Pencil, Search, Trash2, X, Check, GraduationCap, ChevronLeft, Mail } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Student } from "@/lib/sheets/schemas";
import { studentFullName } from "@/lib/sheets/schemas";

export function StudentsList() {
  const [selected, setSelected] = useState<Student | null>(null);
  const [editing, setEditing] = useState<Student | null>(null);
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

  const inviteMut = useMutation({
    mutationFn: async (email: string) => {
      const r = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => toast.success("קישור נשלח למייל"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בשליחת הקישור"),
  });

  const colleges = useMemo(() => {
    const names = (data?.students ?? []).map((s) => s.college_name).filter(Boolean);
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

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<GraduationCap size={20} />}
        title="מתאמנים"
        subtitle={isLoading ? "טוען..." : `${filtered.length} מתאמנים${hasFilters ? ` מתוך ${data?.students.length ?? 0}` : ""}`}
        action={<AddStudentDialog />}
      />
      <div className="px-4 md:px-6 flex flex-col gap-4">

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="חיפוש לפי שם, טלפון, מייל..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-8 h-9 text-sm"
            dir="rtl"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-32 h-9 text-sm">
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
            <SelectTrigger className="w-full sm:w-40 h-9 text-sm">
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
            className="shrink-0 h-9 w-9"
            onClick={() => { setSearch(""); setStatusFilter("all"); setCollegeFilter("all"); }}
            title="נקה סינון"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* List */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm shadow-foreground/[0.04] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]">
        {isLoading ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {hasFilters ? "לא נמצאו מתאמנים תואמים לסינון" : "אין מתאמנים עדיין"}
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map((s) => (
              <StudentRow
                key={s.id}
                student={s}
                confirmDelete={confirmDelete}
                deleting={deleting}
                onEdit={() => setEditing(s)}
                onHistory={() => setSelected(s)}
                onDeleteRequest={() => setConfirmDelete(s.id)}
                onDeleteConfirm={() => handleDelete(s.id)}
                onDeleteCancel={() => setConfirmDelete(null)}
                onInvite={() => inviteMut.mutate(s.email)}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <StudentHistoryDialog
          studentId={selected.id}
          studentName={studentFullName(selected)}
          open={true}
          onOpenChange={(v) => { if (!v) setSelected(null); }}
        />
      )}
      {editing && (
        <EditStudentDialog
          student={editing}
          open={true}
          onOpenChange={(v) => { if (!v) setEditing(null); }}
        />
      )}
      </div>
    </div>
  );
}

function StudentRow({
  student: s,
  confirmDelete,
  deleting,
  onEdit,
  onHistory,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  onInvite,
}: {
  student: Student;
  confirmDelete: string | null;
  deleting: boolean;
  onEdit: () => void;
  onHistory: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onInvite: () => void;
}) {
  const name = studentFullName(s);
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const isConfirming = confirmDelete === s.id;

  const info = [s.phone, s.email, s.college_name].filter(Boolean).join(" · ");

  return (
    <div className={cn(
      "group flex items-center gap-3 px-4 py-2.5 transition-colors duration-150",
      "hover:bg-muted/40 dark:hover:bg-white/[0.03]",
      isConfirming && "bg-destructive/5 dark:bg-destructive/10",
    )}>
      {/* Avatar + name — link to detail page */}
      <Link href={`/admin/students/${s.id}`} className="flex items-center gap-3 flex-1 min-w-0 group/link">
        <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/15 text-primary flex items-center justify-center text-[11px] font-bold shrink-0 select-none group-hover/link:bg-primary/20 transition-colors">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium leading-none group-hover/link:text-primary transition-colors">{name}</span>
            {!s.active && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0">לא פעיל</Badge>
            )}
          </div>
          {info && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{info}</p>
          )}
        </div>
        <ChevronLeft size={13} className="text-muted-foreground/20 group-hover/link:text-primary/40 transition-colors shrink-0" />
      </Link>

      {/* Actions */}
      {isConfirming ? (
        <div className="flex items-center gap-1 shrink-0 animate-scale-in">
          <span className="text-xs text-destructive font-medium ml-1">למחוק?</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:bg-destructive/10"
            disabled={deleting}
            onClick={onDeleteConfirm}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onDeleteCancel}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
            title={s.email ? "שלח קישור הזמנה" : "אין מייל למתאמן זה"}
            disabled={!s.email}
            onClick={onInvite}
          >
            <Mail className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="עריכה"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="היסטוריית נוכחות"
            onClick={onHistory}
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="מחיקה"
            onClick={onDeleteRequest}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
