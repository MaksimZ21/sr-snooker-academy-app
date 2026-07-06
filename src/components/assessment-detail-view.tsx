"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, FileText, Send, CheckCircle2, XCircle, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { TECHNIQUE_CRITERIA, type Assessment } from "@/lib/sheets/assessment-types";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

async function sendWhatsApp(a: Assessment) {
  if (!a.participant_phone) { toast.error("אין מספר טלפון"); return; }
  const tokenRes = await fetch(`/api/assessments/${a.id}/share-token`);
  if (!tokenRes.ok) { toast.error("שגיאה ביצירת קישור"); return; }
  const { token } = (await tokenRes.json()) as { token: string };
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
  if (r.ok) toast.success("נשלח ב-WhatsApp");
  else toast.error("שגיאה בשליחה");
}

export function AssessmentDetailView({
  assessmentId,
  backHref,
  backLabel = "חזרה",
  showCoach = false,
}: {
  assessmentId: string;
  backHref: string;
  backLabel?: string;
  showCoach?: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: async () => {
      const r = await fetch(`/api/assessments/${assessmentId}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { assessment: Assessment };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="flex flex-col gap-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const { assessment: a } = data;
  const passCount = TECHNIQUE_CRITERIA.filter((c) => a.technique[c.key] === true).length;
  const ratedCount = TECHNIQUE_CRITERIA.filter((c) => a.technique[c.key] !== undefined).length;

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
            href={backHref}
            className="flex items-center gap-1.5 text-white/60 text-xs mb-4 hover:text-white transition-colors w-fit"
          >
            <ArrowRight size={13} />
            <span>{backLabel}</span>
          </Link>

          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center text-lg font-bold shrink-0">
              {a.participant_name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">{a.participant_name}</h1>
              <p className="text-white/65 text-sm mt-0.5">{formatDate(a.event_date)}</p>
              {showCoach && (
                <p className="text-white/45 text-xs mt-0.5">{a.coach_email}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-4">
            {a.strong_hand && (
              <span className="bg-white/15 text-white/85 text-xs px-2.5 py-1 rounded-full">
                יד {a.strong_hand === "right" ? "ימין" : "שמאל"}
              </span>
            )}
            {a.strong_eye && (
              <span className="bg-white/15 text-white/85 text-xs px-2.5 py-1 rounded-full">
                עין {a.strong_eye === "right" ? "ימין" : "שמאל"}
              </span>
            )}
            {ratedCount > 0 && (
              <span className="bg-white/20 text-white font-semibold text-xs px-2.5 py-1 rounded-full tabular-nums">
                {passCount}/{ratedCount} עברו
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Technique checklist */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">טכניקה</h2>
          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden divide-y divide-border/40">
            {TECHNIQUE_CRITERIA.map((c) => {
              const val = a.technique[c.key];
              return (
                <div key={c.key} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-sm">{c.label}</span>
                  {val === undefined ? (
                    <Minus size={15} className="text-muted-foreground/30 shrink-0" />
                  ) : val ? (
                    <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                  ) : (
                    <XCircle size={18} className="text-red-400 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        {a.notes && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">הערות</h2>
            <div className="bg-card border border-border/60 rounded-2xl px-4 py-3">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{a.notes}</p>
            </div>
          </div>
        )}

        {/* Photo */}
        {a.photo_url && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">תמונה</h2>
            <div className="rounded-2xl overflow-hidden border border-border/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.photo_url}
                alt={a.participant_name}
                className="w-full object-cover max-h-80"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pb-4">
          <a
            href={`/api/assessments/${a.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <FileText size={15} />
            הורד PDF
          </a>
          {a.participant_phone && (
            <button
              type="button"
              onClick={() => sendWhatsApp(a)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-emerald-600 transition-colors"
            >
              <Send size={15} />
              שלח WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
