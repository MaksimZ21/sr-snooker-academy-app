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
import { SyllabusPanel } from "./syllabus-panel";
import { GuidelinesPanel } from "./guidelines-panel";
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
      <div className="bg-brand-gradient px-5 pt-4 pb-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -bottom-6 left-4 w-28 h-28 rounded-full bg-white/5 blur-xl" />
        </div>

        {/* Top row: date + actions */}
        <div className="flex items-center justify-between relative mb-3">
          <p className="text-white/50 text-xs">{formatHebrewDate(session.date)}</p>
          {isAdmin && (
            <div className="flex items-center gap-1">
              <EditSessionDialog session={session} />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/15"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          )}
        </div>

        {/* Time range */}
        <div className={cn("flex items-baseline gap-2 relative mb-3", cancelled && "opacity-40 line-through")}>
          <span className="text-5xl font-bold tabular-nums text-white leading-none">
            {session.start_time}
          </span>
          {session.end_time && (
            <>
              <span className="text-white/40 text-2xl font-light">—</span>
              <span className="text-2xl font-semibold tabular-nums text-white/75 leading-none">
                {session.end_time}
              </span>
            </>
          )}
        </div>

        {/* Info strip */}
        <div className="flex items-center gap-3 flex-wrap relative">
          <Badge className={cn("border text-xs font-medium", className)} variant="outline">
            {label}
          </Badge>
          {cancelled && <Badge variant="destructive">בוטל</Badge>}
          {coachName && (
            <span className="flex items-center gap-1 text-white/70 text-xs">
              <User size={11} />
              {coachName}
            </span>
          )}
          <span className="flex items-center gap-1 text-white/55 text-xs">
            <Users size={11} />
            {session.student_ids.length} מתאמנים
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
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="attendance">נוכחות</TabsTrigger>
            <TabsTrigger value="notes">הערות</TabsTrigger>
            <TabsTrigger value="syllabus">סילבוס</TabsTrigger>
            <TabsTrigger value="guidelines">הנחיות</TabsTrigger>
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
          <TabsContent value="syllabus">
            <SyllabusPanel sessionId={sessionId} />
          </TabsContent>
          <TabsContent value="guidelines">
            <GuidelinesPanel trainingType={session.training_type} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
