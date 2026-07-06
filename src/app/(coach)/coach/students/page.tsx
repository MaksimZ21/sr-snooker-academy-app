"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, MessageSquare, ChevronLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Student } from "@/lib/sheets/schemas";
import { studentFullName } from "@/lib/sheets/schemas";

type StudentRow = Student & { groups: { id: string; name: string }[]; notes_count: number };

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();
}

export default function CoachStudentsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["coach:students"],
    queryFn: async () => {
      const r = await fetch("/api/coach/students");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { students: StudentRow[] };
    },
  });

  const students = (data?.students ?? []).filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return studentFullName(s).toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      s.groups.some((g) => g.name.toLowerCase().includes(q));
  });

  return (
    <div className="flex flex-col">
      <PageHeader
        icon={<Users size={20} />}
        title="המתאמנים שלי"
        subtitle="מתאמנים מהקבוצות שלך"
      />

      <div className="px-4 pb-4 flex flex-col gap-3">
        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            placeholder="חיפוש לפי שם, טלפון או קבוצה..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 pr-9 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            {search ? "לא נמצאו מתאמנים" : "אין מתאמנים בקבוצות שלך"}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {students.map((s) => {
              const name = studentFullName(s);
              return (
                <Link
                  key={s.id}
                  href={`/coach/students/${s.id}`}
                  className="flex items-center gap-3 bg-card border border-border/60 rounded-2xl px-4 py-3.5 hover:border-primary/30 hover:bg-primary/3 transition-colors active:scale-[0.98]"
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-primary/12 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                    {getInitials(name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.groups.map((g) => g.name).join(", ") || "ללא קבוצה"}
                    </p>
                    {s.phone && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5 tabular-nums">{s.phone}</p>
                    )}
                  </div>

                  {/* Notes badge */}
                  {s.notes_count > 0 && (
                    <span className={cn(
                      "flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0",
                      "bg-primary/10 text-primary",
                    )}>
                      <MessageSquare size={10} />
                      {s.notes_count}
                    </span>
                  )}

                  <ChevronLeft size={16} className="text-muted-foreground/30 shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
