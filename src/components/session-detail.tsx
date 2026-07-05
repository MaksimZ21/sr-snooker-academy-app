"use client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Session, Student, Attendance, Note } from "@/lib/sheets/schemas";
import { AttendancePanel } from "./attendance-panel";
import { NotesPanel } from "./notes-panel";
import { EditSessionDialog } from "./forms/edit-session-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHebrewDate } from "@/lib/date";
import { trainingTypeBadge } from "@/lib/training-type";
import { cn } from "@/lib/utils";
import { User, Users, Trash2 } from "lucide-react";

type Coach = { email: string; name: string; active: boolean };

type Detail = {
  session: Session;
  students: Student[];
  attendance: Attendance[];
  notesByStudent: Record<string, Note[]>;
};

export function SessionDetail({
  sessionId,
  canEditAttendance,
  canEditNotes,
  isAdmin = false,
}: {
  sessionId: string;
  canEditAttendance: boolean;
  canEditNotes: boolean;
  isAdmin?: boolean;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const r = await fetch(`/api/sessions/${sessionId}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as Detail;
    },
    refetchInterval: 30_000,
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
    mutationFn: async () => {
      const r = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("המפגש נמחק");
      qc.invalidateQueries({ queryKey: ["sessions:week"] });
      router.push("/admin/schedule");
    },
    onError: () => toast.error("שגיאה במחיקה"),
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col">
        <div className="bg-brand-gradient px-5 py-5">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-3 w-24 bg-white/15" />
            <Skeleton className="h-7 w-16 bg-white/15" />
          </div>
          <Skeleton className="h-12 w-40 bg-white/20 mb-3" />
          <Skeleton className="h-5 w-32 bg-white/15" />
        </div>
        <div className="p-4 flex flex-col gap-4">
          <Skeleton className="h-9 w-full rounded-md" />
          <div className="flex flex-col gap-3 mt-2">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  const { session, students, attendance, notesByStudent } = data;
  const { label, className } = trainingTypeBadge(session.training_type);
  const cancelled = session.status === "cancelled";
  const coachName = session.coach_email
    ? ((coachesQ.data?.coaches ?? []).find((c) => c.email === session.coach_email)?.name ?? session.coach_email.split("@")[0])
    : null;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-brand-gradient px-5 pt-4 pb-6 relative overflow-hidden">
        {/* Animated background orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* White drift — large, slow */}
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/6 blur-3xl animate-drift-1" />
          {/* Amber glow — snooker yellow ball reference */}
          <div
            className="absolute -bottom-16 -left-8 w-56 h-56 rounded-full blur-3xl animate-drift-2"
            style={{ background: "radial-gradient(circle, oklch(0.85 0.17 80 / 0.14) 0%, transparent 70%)" }}
          />
          {/* Soft mid accent */}
          <div className="absolute top-1/2 right-1/2 w-24 h-24 rounded-full bg-white/4 blur-2xl animate-drift-3" />
        </div>

        {/* Top row: date + actions */}
        <div className="flex items-center justify-between relative mb-5">
          <p className="text-white/45 text-xs tracking-wide">{formatHebrewDate(session.date)}</p>
          {isAdmin && (
            <div className="flex items-center gap-1">
              <EditSessionDialog session={session} />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/12 rounded-lg"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          )}
        </div>

        {/* Times — equal weight, scoreboard */}
        <div className={cn("flex items-center gap-3 relative mb-4", cancelled && "opacity-35")}>
          <span className="text-5xl font-bold tabular-nums text-white leading-none tracking-tight scoreboard-num">
            {session.start_time}
          </span>
          <span className="text-white/25 text-2xl font-extralight select-none">—</span>
          <span className={cn(
            "text-5xl font-bold tabular-nums leading-none tracking-tight scoreboard-num",
            session.end_time ? "text-white" : "text-white/30",
          )}>
            {session.end_time || "--:--"}
          </span>
          {cancelled && (
            <span className="text-white/60 text-sm font-medium mr-1">בוטל</span>
          )}
        </div>

        {/* Info strip */}
        <div className="flex items-center gap-2.5 flex-wrap relative">
          <Badge
            className={cn("border text-xs font-medium px-2.5 py-0.5", className)}
            variant="outline"
          >
            {label}
          </Badge>
          {coachName && (
            <span className="flex items-center gap-1.5 text-white/65 text-xs">
              <User size={11} className="shrink-0" />
              {coachName}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-white/45 text-xs">
            <Users size={11} className="shrink-0" />
            {session.student_ids.length}
          </span>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>מחיקת מפגש</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            האם למחוק את המפגש מ-{formatHebrewDate(session.date)} בשעה {session.start_time}? פעולה זו אינה הפיכה.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleteMut.isPending}>
              ביטול
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "מוחק..." : "מחק"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <div className="p-4 flex flex-col gap-4">
        <Tabs defaultValue="attendance">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="attendance">נוכחות</TabsTrigger>
            <TabsTrigger value="notes">הערות</TabsTrigger>
          </TabsList>
          <TabsContent value="attendance">
            <AttendancePanel
              sessionId={sessionId}
              students={students}
              attendance={attendance}
              readOnly={!canEditAttendance}
            />
          </TabsContent>
          <TabsContent value="notes">
            <NotesPanel
              sessionId={sessionId}
              students={students}
              notesByStudent={notesByStudent}
              readOnly={!canEditNotes}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
