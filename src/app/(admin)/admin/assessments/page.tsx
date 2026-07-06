"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { FileText, Plus, Search, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
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
  if (!a.participant_phone) { toast.error("אין מספר טלפון"); return; }
  const tokenRes = await fetch(`/api/assessments/${a.id}/share-token`);
  if (!tokenRes.ok) { toast.error("שגיאה ביצירת קישור"); return; }
  const { token } = await tokenRes.json() as { token: string };
  const pdfUrl = `${window.location.origin}/api/assessments/${a.id}/pdf?token=${token}`;
  const r = await fetch("/api/whatsapp/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      phone: a.participant_phone,
      urlFile: pdfUrl,
      fileName: `דוח אבחון - ${a.participant_name}.pdf`,
      caption: `שלום ${a.participant_name}, דוח האבחון שלך נמצא כאן`,
    }),
  });
  if (r.ok) toast.success("נשלח"); else toast.error("שגיאה");
}

export default function AdminAssessmentsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["assessments:admin"],
    queryFn: async () => {
      const r = await fetch("/api/assessments");
      return (await r.json()) as { assessments: Assessment[] };
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.assessments ?? [];
    return (data?.assessments ?? []).filter(
      (a) =>
        a.participant_name.toLowerCase().includes(q) ||
        (a.participant_phone ?? "").includes(q) ||
        a.coach_email.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<FileText size={20} />}
        title="דוחות אבחון"
        subtitle={isLoading ? "טוען..." : `${filtered.length} דוחות`}
        action={
          <Link href="/admin/assessments/new">
            <Button size="sm">
              <Plus size={14} className="ml-1.5" />
              דוח חדש
            </Button>
          </Link>
        }
      />
      <div className="px-4 md:px-6 flex flex-col gap-4">

      <div className="relative">
        <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="חיפוש לפי שם, טלפון, מאמן..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-8 h-9 text-sm"
          dir="rtl"
        />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm dark:ring-1 dark:ring-white/[0.06]">
        {isLoading ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-52" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">אין דוחות</div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map((a) => {
              const pass = passCount(a);
              const rated = ratedCount(a);
              return (
                <div
                  key={a.id}
                  className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/40 dark:hover:bg-white/[0.03] transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 dark:bg-primary/15 text-primary flex items-center justify-center text-[11px] font-bold shrink-0 select-none">
                    {a.participant_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </div>

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
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {formatDate(a.event_date)}
                      {a.participant_phone ? ` · ${a.participant_phone}` : ""}
                      {" · "}מאמן: {a.coach_email}
                    </p>
                  </div>

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
