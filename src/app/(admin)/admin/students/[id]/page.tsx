"use client";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { studentFullName } from "@/lib/sheets/schemas";
import type { Student, Note } from "@/lib/sheets/schemas";
import type { Assessment } from "@/lib/sheets/assessment-types";
import { TECHNIQUE_CRITERIA } from "@/lib/sheets/assessment-types";

type Detail = {
  student: Student;
  groups: { id: string; name: string; coach_email: string }[];
  notes: Note[];
  assessments: Assessment[];
  attendance_summary: { present: number; absent: number; total: number };
};

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

  const { student, groups, notes, assessments, attendance_summary } = data;
  const name = studentFullName(student);
  const attendancePct =
    attendance_summary.total > 0
      ? Math.round((attendance_summary.present / attendance_summary.total) * 100)
      : null;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-brand-gradient relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="session-orb absolute rounded-full"
            style={{
              top: "-30px",
              right: "-30px",
              width: "180px",
              height: "180px",
              background: "radial-gradient(circle, rgba(255,255,255,0.28) 0%, transparent 65%)",
              filter: "blur(32px)",
              animation: "drift-1 12s ease-in-out infinite",
            }}
          />
          <div
            className="session-orb absolute rounded-full"
            style={{
              bottom: "-20px",
              left: "10px",
              width: "140px",
              height: "140px",
              background: "radial-gradient(circle, rgba(251,191,36,0.35) 0%, transparent 65%)",
              filter: "blur(24px)",
              animation: "drift-2 16s ease-in-out infinite 3s",
            }}
          />
        </div>

        <div className="relative z-10 px-5 pt-4 pb-6">
          <Link
            href="/admin/students"
            className="flex items-center gap-1.5 text-white/60 text-xs mb-4 hover:text-white transition-colors w-fit"
          >
            <ArrowRight size={13} />
            <span>מתאמנים</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 text-white flex items-center justify-center text-xl font-bold shrink-0">
              {getInitials(name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white leading-tight">{name}</h1>
                {!student.active && (
                  <span className="bg-white/20 text-white/80 text-[10px] px-2 py-0.5 rounded-full">
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
            {
              label: "נוכח",
              value: attendance_summary.present,
              icon: CheckCircle,
              color: "text-green-600 bg-green-500/10",
            },
            {
              label: "נעדר",
              value: attendance_summary.absent,
              icon: XCircle,
              color: "text-red-500 bg-red-500/10",
            },
            {
              label: "נוכחות",
              value: attendancePct !== null ? `${attendancePct}%` : "—",
              icon: null,
              color: "text-primary bg-primary/10",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={cn("rounded-2xl p-3 flex flex-col items-center gap-1", stat.color)}
            >
              {stat.icon && <stat.icon size={16} />}
              <span className="text-xl font-bold tabular-nums">{stat.value}</span>
              <span className="text-[11px] font-medium opacity-70">{stat.label}</span>
            </div>
          ))}
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
                  (c) => a.technique[c.key] === true,
                ).length;
                const ratedCount = TECHNIQUE_CRITERIA.filter(
                  (c) => a.technique[c.key] !== undefined,
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
                        className="text-[10px] h-5 px-1.5 shrink-0"
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
