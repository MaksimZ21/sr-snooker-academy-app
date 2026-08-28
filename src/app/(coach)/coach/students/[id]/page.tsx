"use client";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Phone, Users, MessageSquare, CheckCircle, XCircle } from "lucide-react";
import { StudentGoalSummary } from "@/components/student-goal-summary";
import { studentFullName } from "@/lib/sheets/schemas";
import type { Student, Note } from "@/lib/sheets/schemas";
import { cn } from "@/lib/utils";

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
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="session-orb absolute rounded-full" style={{
            top: "-30px", right: "-30px", width: "180px", height: "180px",
            background: "radial-gradient(circle, rgba(255,255,255,0.28) 0%, transparent 65%)",
            filter: "blur(32px)",
            animation: "drift-1 12s ease-in-out infinite",
          }} />
          <div className="session-orb absolute rounded-full" style={{
            bottom: "-20px", left: "10px", width: "140px", height: "140px",
            background: "radial-gradient(circle, rgba(251,191,36,0.35) 0%, transparent 65%)",
            filter: "blur(24px)",
            animation: "drift-2 16s ease-in-out infinite 3s",
          }} />
        </div>

        <div className="relative z-10 px-5 pt-4 pb-6">
          {/* Back */}
          <Link href="/coach/students" className="flex items-center gap-1.5 text-white/60 text-xs mb-4 hover:text-white transition-colors w-fit">
            <ArrowRight size={13} />
            <span>המתאמנים שלי</span>
          </Link>

          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 text-white flex items-center justify-center text-xl font-bold shrink-0">
              {getInitials(name)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">{name}</h1>
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
              <span className="bg-white/15 text-white/85 text-xs px-2.5 py-0.5 rounded-full">
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

      <div className="p-4 flex flex-col gap-4">
        {/* Attendance stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "נוכח", value: attendance_summary.present, icon: CheckCircle, color: "text-green-600 bg-green-500/10" },
            { label: "נעדר", value: attendance_summary.absent, icon: XCircle, color: "text-red-500 bg-red-500/10" },
            { label: "נוכחות", value: attendancePct !== null ? `${attendancePct}%` : "—", icon: null, color: "text-primary bg-primary/10" },
          ].map((stat) => (
            <div key={stat.label} className={cn("rounded-2xl p-3 flex flex-col items-center gap-1", stat.color)}>
              {stat.icon && <stat.icon size={16} />}
              <span className="text-xl font-bold tabular-nums">{stat.value}</span>
              <span className="text-[11px] font-medium opacity-70">{stat.label}</span>
            </div>
          ))}
        </div>

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
