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
      <div className="bg-brand-gradient relative overflow-hidden">
        {/* Orbs — inline animation to guarantee browser picks it up */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="session-orb absolute rounded-full" style={{
            top: "-40px", right: "-40px", width: "220px", height: "220px",
            background: "radial-gradient(circle, rgba(255,255,255,0.32) 0%, transparent 65%)",
            filter: "blur(36px)",
            animation: "drift-1 10s ease-in-out infinite",
          }} />
          <div className="session-orb absolute rounded-full" style={{
            bottom: "-30px", left: "-10px", width: "180px", height: "180px",
            background: "radial-gradient(circle, rgba(251,191,36,0.42) 0%, transparent 65%)",
            filter: "blur(28px)",
            animation: "drift-2 14s ease-in-out infinite 4s",
          }} />
          <div className="session-orb absolute rounded-full" style={{
            top: "30px", left: "42%", width: "90px", height: "90px",
            background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)",
            filter: "blur(18px)",
            animation: "drift-3 9s ease-in-out infinite 1.5s",
          }} />
        </div>

        {/* Admin action buttons — absolute top corner */}
        {isAdmin && (
          <div className="absolute top-3 end-3 flex items-center gap-1 z-20">
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
          <p className="text-white/55 text-xs tracking-widest mb-5">
            {formatHebrewDate(session.date)}
          </p>

          {/* Times */}
          <div className={cn("flex items-baseline gap-3 mb-5", cancelled && "opacity-40")}>
            <span className="text-6xl font-bold tabular-nums text-white leading-none tracking-tight scoreboard-num">
              {session.start_time}
            </span>
            <span className="text-white/30 text-3xl font-extralight select-none">—</span>
            <span className={cn(
              "text-6xl font-bold tabular-nums leading-none tracking-tight scoreboard-num",
              session.end_time ? "text-white/85" : "text-white/30",
            )}>
              {session.end_time || "--:--"}
            </span>
          </div>

          {/* Info chips */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <Badge
              className={cn("border text-xs font-medium px-2.5 py-0.5", className)}
              variant="outline"
            >
              {label}
            </Badge>
            {cancelled && (
              <span className="text-red-300/80 text-xs font-medium border border-red-300/30 rounded-full px-2 py-0.5">
                בוטל
              </span>
            )}
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
