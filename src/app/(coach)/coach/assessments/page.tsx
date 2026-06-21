"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { TECHNIQUE_CRITERIA, type Assessment } from "@/lib/sheets/assessment-types";

function formatDate(d: string) {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

function passCount(a: Assessment) {
  return TECHNIQUE_CRITERIA.filter((c) => a.technique[c.key] === true).length;
}
function ratedCount(a: Assessment) {
  return TECHNIQUE_CRITERIA.filter((c) => a.technique[c.key] !== undefined).length;
}

async function sendWhatsApp(a: Assessment) {
  if (!a.participant_phone) {
    toast.error("אין מספר טלפון למשתתף זה");
    return;
  }
  const msg = `שלום ${a.participant_name},\nהדוח האבחון שלך מוכן. ניתן להורידו מהקישור הבא:\n${window.location.origin}/api/assessments/${a.id}/pdf`;
  const r = await fetch("/api/whatsapp/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: a.participant_phone, message: msg }),
  });
  if (r.ok) toast.success("נשלח ב-WhatsApp");
  else toast.error("שגיאה בשליחה");
}

export default function CoachAssessmentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["assessments"],
    queryFn: async () => {
      const r = await fetch("/api/assessments");
      return (await r.json()) as { assessments: Assessment[] };
    },
    staleTime: 60_000,
  });

  const assessments = data?.assessments ?? [];

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-5 pb-2 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">דוחות אבחון</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? "טוען..." : `${assessments.length} דוחות`}
          </p>
        </div>
        <Link href="/coach/assessments/new">
          <Button size="sm">
            <Plus size={14} className="ml-1.5" />
            דוח חדש
          </Button>
        </Link>
      </div>

      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm dark:ring-1 dark:ring-white/[0.06]">
          {isLoading ? (
            <div className="divide-y divide-border/50">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : assessments.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center gap-3">
              <FileText size={32} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">אין דוחות עדיין</p>
              <Link href="/coach/assessments/new">
                <Button size="sm" variant="outline">צור דוח ראשון</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {assessments.map((a) => {
                const pass = passCount(a);
                const rated = ratedCount(a);
                return (
                  <div
                    key={a.id}
                    className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/40 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-primary/10 dark:bg-primary/15 text-primary flex items-center justify-center text-[11px] font-bold shrink-0 select-none">
                      {a.participant_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{a.participant_name}</span>
                        {rated > 0 && (
                          <Badge
                            variant={pass >= rated * 0.7 ? "default" : "secondary"}
                            className="text-[10px] h-4 px-1.5"
                          >
                            {pass}/{rated} ✓
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDate(a.event_date)}
                        {a.participant_phone ? ` · ${a.participant_phone}` : ""}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <a
                        href={`/api/assessments/${a.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        title="הורד PDF"
                      >
                        <FileText size={15} />
                      </a>
                      <button
                        type="button"
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                        title="שלח ב-WhatsApp"
                        onClick={() => sendWhatsApp(a)}
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
