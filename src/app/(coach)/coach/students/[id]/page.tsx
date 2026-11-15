"use client";
import { NoteTeamBadge } from "@/components/notes-panel";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Phone, Users, MessageSquare, CheckCircle, XCircle } from "lucide-react";
import { StudentGoalSummary } from "@/components/student-goal-summary";
import { studentFullName } from "@/lib/sheets/schemas";
import type { Student, Note } from "@/lib/sheets/schemas";
import { cn } from "@/lib/utils";
import { AttendanceForm } from "@/components/attendance-form";

type Detail = {
  student: Student;
  groups: { id: string; name: string }[];
  notes: Note[];
  attendance_summary: { present: number; absent: number; total: number };
};

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();
}

export default function CoachStudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: ["coach:student", id],
    queryFn: async () => {
      const r = await fetch(`/api/coach/students/${id}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as Detail;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-36 w-full rounded-3xl" />
        <Skeleton className="h-8 w-40 rounded-xl" />
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const { student, groups, notes, attendance_summary } = data;
  const name = studentFullName(student);
  const attendancePct = attendance_summary.total > 0
    ? Math.round((attendance_summary.present / attendance_summary.total) * 100)
    : null;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-brand-gradient relative overflow-hidden">

        <div className="relative z-10 px-5 pt-4 pb-6">
          {/* Back */}
          <Link href="/coach/students" className="flex items-center gap-1.5 text-white/60 text-xs mb-4 hover:text-white transition-colors w-fit">
            <ArrowRight size={13} />
            <span>המתאמנים שלי</span>
          </Link>

          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-sidebar text-[#7ee2a4] flex items-center justify-center font-display text-xl font-extrabold shrink-0 bc-slant">
              {getInitials(name)}
            </div>
            <div>
              <h1 className="bc-num text-[28px] md:text-[36px] text-white leading-tight">{name}</h1>
              {groups.length > 0 && (
                <p className="text-white/65 text-sm mt-0.5">
                  {groups.map((g) => g.name).join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* Info chips */}
          <div className="flex items-center gap-2.5 flex-wrap mt-4">
            {student.phone && (
              <span className="flex items-center gap-1.5 text-white/70 text-xs">
                <Phone size={11} />
                {student.phone}
              </span>
            )}
            {student.subscription_type && (
              <span className="rounded-lg bg-white/15 px-2.5 py-1 font-display text-xs font-bold text-white">
                {student.subscription_type}
              </span>
            )}
            {student.college_name && (
              <span className="flex items-center gap-1.5 text-white/60 text-xs">
                <Users size={11} />
                {student.college_name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4 w-full max-w-4xl mx-auto">
        {/* Attendance stats */}
        <AttendanceForm
          present={attendance_summary.present}
          absent={attendance_summary.absent}
          total={attendance_summary.total}
        />

        {/* Monthly goal */}
        <StudentGoalSummary studentId={student.id} />

        {/* Notes */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground">הערות</h2>
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
                <div key={n.id} className="bg-card border border-border/60 rounded-2xl px-4 py-3">
                  <NoteTeamBadge note={n} />
                  <p className="text-sm leading-relaxed">{n.text}</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-1.5">
                    {new Date(n.created_at).toLocaleString("he-IL", {
                      day: "numeric", month: "long", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
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
