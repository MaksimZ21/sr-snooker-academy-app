"use client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Session, Student, Attendance, Note } from "@/lib/sheets/schemas";
import { AttendancePanel } from "./attendance-panel";
import { NotesPanel } from "./notes-panel";
import { GoalPanel, type GoalsByStudent } from "./goal-panel";
import { EditSessionDialog } from "./forms/edit-session-dialog";
import { DuplicateSessionDialog } from "./forms/duplicate-session-dialog";
import { SessionHeldButton } from "./session-held-button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHebrewDate } from "@/lib/date";
import { monthOf } from "@/lib/sheets/monthly-goals-shared";
import { trainingTypeBadge } from "@/lib/training-type";
import { cn } from "@/lib/utils";
import { TYPE_COLORS } from "@/components/broadcast";
import { User, Users, Trash2 } from "lucide-react";
import { HeroBackdrop } from "@/components/motion/hero-backdrop";

type Coach = { email: string; name: string; active: boolean };

type Detail = {
  session: Session;
  students: Student[];
  attendance: Attendance[];
  notesByStudent: Record<string, Note[]>;
  goalsByStudent: GoalsByStudent;
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

  const { session, students, attendance, notesByStudent, goalsByStudent } = data;
  const { label } = trainingTypeBadge(session.training_type);
  const cancelled = session.status === "cancelled";
  const coachName = session.coach_email
    ? ((coachesQ.data?.coaches ?? []).find((c) => c.email === session.coach_email)?.name ?? session.coach_email.split("@")[0])
    : null;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-brand-plain relative isolate overflow-hidden">
        <HeroBackdrop />

        {/* Admin action buttons — absolute top corner */}
        {isAdmin && (
          <div className="absolute top-3 end-3 flex items-center gap-1 z-20">
            <DuplicateSessionDialog session={session} />
            <EditSessionDialog session={session} />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/15 rounded-lg"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        )}

        {/* Centered content */}
        <div className="relative z-10 flex flex-col items-center text-center px-5 pt-5 pb-7">
          {/* Date */}
          <p className="font-display font-bold text-white/75 text-sm mb-4">
            {formatHebrewDate(session.date)}
          </p>

          {/* Times */}
          <div className={cn("flex items-baseline gap-3 mb-5", cancelled && "opacity-40")}>
            <span className="bc-num text-6xl md:text-7xl text-white leading-none">
              {session.start_time}
            </span>
            <span className="text-white/40 text-3xl font-extralight select-none">—</span>
            <span className={cn(
              "bc-num text-6xl md:text-7xl leading-none",
              session.end_time ? "text-white/85" : "text-white/30",
            )}>
              {session.end_time || "--:--"}
            </span>
          </div>

          {/* Info chips */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 font-display text-xs font-bold text-white">
              <i className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[session.training_type] ?? "#94a3b8" }} />
              {label}
            </span>
            {cancelled && (
              <span className="text-red-300/80 text-xs font-medium border border-red-300/30 rounded-full px-2 py-0.5">
                לא התקיים
              </span>
            )}
            {coachName && (
              <span className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 font-display text-xs font-bold text-white">
                <User size={12} className="shrink-0" />
                {coachName}
              </span>
            )}
            <span className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 font-display text-xs font-bold text-white">
              <Users size={12} className="shrink-0" />
              {session.student_ids.length} מתאמנים
            </span>
          </div>
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
      <div className="p-4 flex flex-col gap-4 w-full max-w-4xl mx-auto">
        {(isAdmin || canEditAttendance) && (
          <div className="flex justify-end -mb-1">
            <SessionHeldButton sessionId={sessionId} cancelled={cancelled} />
          </div>
        )}
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
              notesByStudent={notesByStudent}
              readOnly={!canEditAttendance}
              isAdmin={isAdmin}
            />
          </TabsContent>
          <TabsContent value="notes">
            <div className="flex flex-col gap-5">
              <div>
                <p className="font-display text-sm font-extrabold mb-2">
                  מטרה חודשית
                </p>
                <GoalPanel
                  sessionId={sessionId}
                  month={monthOf(session.date)}
                  students={students}
                  goalsByStudent={goalsByStudent}
                  readOnly={!canEditAttendance}
                />
              </div>
              <div>
                <p className="font-display text-sm font-extrabold mb-2">
                  הערות
                </p>
                <NotesPanel
                  sessionId={sessionId}
                  students={students}
                  notesByStudent={notesByStudent}
                  readOnly={!canEditNotes}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
