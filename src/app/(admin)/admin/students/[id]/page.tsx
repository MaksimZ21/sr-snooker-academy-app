"use client";
import { NoteTeamBadge } from "@/components/notes-panel";
import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowRight,
  Phone,
  Mail,
  Users,
  MessageSquare,
  CheckCircle,
  XCircle,
  ClipboardList,
  ChevronRight,
  Trophy,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StudentGoalSummary } from "@/components/student-goal-summary";
import { cn } from "@/lib/utils";
import { AttendanceForm } from "@/components/attendance-form";
import { toast } from "sonner";
import { studentFullName } from "@/lib/sheets/schemas";
import type { Student, Note, Session, Attendance } from "@/lib/sheets/schemas";
import type { Assessment } from "@/lib/sheets/assessment-types";
import { TECHNIQUE_CRITERIA, normalizeTechniqueRating } from "@/lib/sheets/assessment-types";
import { HeroBackdrop } from "@/components/motion/hero-backdrop";

type AttendanceDetailRow = { session: Session; attendance_status: Attendance["status"] };

type Detail = {
  student: Student;
  groups: { id: string; name: string; coach_email: string }[];
  notes: Note[];
  assessments: Assessment[];
  attendance_summary: { present: number; absent: number; total: number };
  attendance_detail: AttendanceDetailRow[];
};

const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  present: "נוכח",
  absent: "לא נוכח",
  late: "איחור",
  confirmed: "אושר",
  declined: "דחה הגעה",
};

const ATTENDANCE_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  present: "default",
  absent: "destructive",
  late: "secondary",
  confirmed: "outline",
  declined: "destructive",
};

function formatSessionDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function AdminStudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const activatePlayerMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/students/${id}/activate-player`, { method: "POST" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("אזור הטורנירים נפתח למתאמן");
      queryClient.invalidateQueries({ queryKey: ["admin:student", id] });
    },
    onError: () => toast.error("שגיאה בפתיחת אזור הטורנירים"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin:student", id],
    queryFn: async () => {
      const r = await fetch(`/api/admin/students/${id}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as Detail;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const { student, groups, notes, assessments, attendance_summary, attendance_detail } = data;
  const name = studentFullName(student);
  const attendancePct =
    attendance_summary.total > 0
      ? Math.round((attendance_summary.present / attendance_summary.total) * 100)
      : null;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-brand-plain relative isolate overflow-hidden">
        <HeroBackdrop />

        <div className="relative z-10 px-5 pt-4 pb-6">
          <Link
            href="/admin/students"
            className="flex items-center gap-1.5 text-white/60 text-xs mb-4 hover:text-white transition-colors w-fit"
          >
            <ArrowRight size={13} />
            <span>מתאמנים</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-sidebar text-[#7ee2a4] flex items-center justify-center font-display text-xl font-extrabold shrink-0 bc-slant">
              {getInitials(name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="bc-num text-[28px] md:text-[36px] text-white leading-tight">{name}</h1>
                {!student.active && (
                  <span className="bg-white/20 text-white/80 text-[11px] px-2 py-0.5 rounded-full">
                    לא פעיל
                  </span>
                )}
              </div>
              {groups.length > 0 && (
                <p className="text-white/65 text-sm mt-0.5">
                  {groups.map((g) => g.name).join(", ")}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap mt-4">
            {student.phone && (
              <span className="flex items-center gap-1.5 text-white/70 text-xs">
                <Phone size={11} />
                {student.phone}
              </span>
            )}
            {student.email && (
              <span className="flex items-center gap-1.5 text-white/60 text-xs">
                <Mail size={11} />
                {student.email}
              </span>
            )}
            {student.subscription_type && (
              <span className="rounded-lg bg-white/15 px-2.5 py-1 font-display text-xs font-bold text-white">
                {student.subscription_type}
              </span>
            )}
            {student.skill_level_9ft && (
              <span className="rounded-lg bg-white/15 px-2.5 py-1 font-display text-xs font-bold text-white">
                9-10 פיט: {student.skill_level_9ft}
              </span>
            )}
            {student.skill_level && (
              <span className="rounded-lg bg-white/15 px-2.5 py-1 font-display text-xs font-bold text-white">
                12 פיט: {student.skill_level}
              </span>
            )}
            {student.college_name && (
              <span className="flex items-center gap-1.5 text-white/60 text-xs">
                <Users size={11} />
                {student.college_name}
              </span>
            )}
          </div>

          {!student.is_tournament_only && (
            <div className="mt-3">
              {student.public_slug ? (
                <span className="flex items-center gap-1.5 w-fit bg-white/15 text-white/85 text-xs px-2.5 py-1 rounded-full">
                  <Trophy size={12} />
                  שחקן טורנירים
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
                  disabled={activatePlayerMut.isPending}
                  onClick={() => activatePlayerMut.mutate()}
                >
                  <Trophy size={12} className="ml-1.5" />
                  {activatePlayerMut.isPending ? "פותח..." : "פתח לו את אזור הטורנירים"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4 w-full max-w-4xl mx-auto">
        {/* Attendance stats */}
        <AttendanceForm
          present={attendance_summary.present}
          absent={attendance_summary.absent}
          total={attendance_summary.total}
          recent={attendance_detail.slice(0, 24).map((row) => ({
            id: row.session.id,
            status: row.attendance_status,
            label: `${formatSessionDate(row.session.date)} · ${ATTENDANCE_STATUS_LABEL[row.attendance_status] ?? ""}`,
          }))}
        />

        {/* Attendance history */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground">היסטוריית אימונים</h2>
            {attendance_detail.length > 0 && (
              <span className="text-xs text-muted-foreground/50 bg-muted rounded-full px-2 py-0.5 tabular-nums">
                {attendance_detail.length}
              </span>
            )}
          </div>

          {attendance_detail.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground/50 text-sm border border-dashed border-border/60 rounded-2xl">
              אין עדיין אימונים עם נוכחות מסומנת
            </div>
          ) : (
            <div className="rounded-[18px] border bg-card divide-y overflow-hidden">
              {attendance_detail.map((row) => (
                <Link
                  key={row.session.id}
                  href={`/admin/sessions/${row.session.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-2.5 hover:bg-muted/40 transition-colors"
                >
                  <span className="text-sm font-medium truncate">{formatSessionDate(row.session.date)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">
                    {row.session.start_time}–{row.session.end_time}
                  </span>
                  <Badge variant={ATTENDANCE_STATUS_VARIANT[row.attendance_status]} className="shrink-0 min-w-16 justify-center">
                    {ATTENDANCE_STATUS_LABEL[row.attendance_status]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Groups */}
        {groups.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users size={15} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground">קבוצות</h2>
            </div>
            <div className="flex flex-col gap-1.5">
              {groups.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between bg-card border border-border/60 rounded-xl px-4 py-2.5"
                >
                  <span className="text-sm font-medium">{g.name}</span>
                  <span className="text-xs text-muted-foreground/60">{g.coach_email}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* General notes on student */}
        {student.general_notes && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">הערות כלליות</h2>
            <div className="bg-card border border-border/60 rounded-2xl px-4 py-3">
              <p className="text-sm leading-relaxed">{student.general_notes}</p>
            </div>
          </div>
        )}

        {/* Monthly goal */}
        <StudentGoalSummary studentId={student.id} />

        {/* Assessments */}
        {assessments.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList size={15} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground">דוחות אבחון</h2>
              <span className="text-xs text-muted-foreground/50 bg-muted rounded-full px-2 py-0.5 tabular-nums">
                {assessments.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {assessments.map((a) => {
                const passCount = TECHNIQUE_CRITERIA.filter(
                  (c) => normalizeTechniqueRating(a.technique[c.key]) === "good",
                ).length;
                const ratedCount = TECHNIQUE_CRITERIA.filter(
                  (c) => normalizeTechniqueRating(a.technique[c.key]) !== undefined,
                ).length;
                return (
                  <Link
                    key={a.id}
                    href={`/admin/assessments/${a.id}`}
                    className="flex items-center gap-3 bg-card border border-border/60 rounded-2xl px-4 py-3 hover:border-primary/30 hover:bg-primary/3 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{formatDate(a.event_date)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.coach_email}</p>
                    </div>
                    {ratedCount > 0 && (
                      <Badge
                        variant={passCount >= ratedCount * 0.7 ? "default" : "secondary"}
                        className="text-[11px] h-5 px-1.5 shrink-0"
                      >
                        {passCount}/{ratedCount}
                      </Badge>
                    )}
                    <ChevronRight size={15} className="text-muted-foreground/30 shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Session notes */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground">הערות מאימונים</h2>
            {notes.length > 0 && (
              <span className="text-xs text-muted-foreground/50 bg-muted rounded-full px-2 py-0.5 tabular-nums">
                {notes.length}
              </span>
            )}
          </div>

          {notes.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground/50 text-sm border border-dashed border-border/60 rounded-2xl">
              אין הערות עדיין
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className="bg-card border border-border/60 rounded-2xl px-4 py-3"
                >
                  <NoteTeamBadge note={n} />
                  <p className="text-sm leading-relaxed">{n.text}</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-1.5">
                    {new Date(n.created_at).toLocaleString("he-IL", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
